import { timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { CreatePaymentDto } from './dtos/create-payment.dto';
import { InfinitePayWebhookDto } from './dtos/infinitepay-webhook.dto';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { IPaymentGateway, PAYMENT_GATEWAY_TOKEN } from './providers/payment-gateway.interface';
import { CENTS_PER_CURRENCY_UNIT } from '../common/constants';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { StockLog, MovementType } from '../inventory/entities/stock-log.entity';
import { Stock } from '../inventory/entities/stock.entity';
import { Order, OrderStatus, TipoRetirada } from '../orders/entities/order.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_GATEWAY_TOKEN)
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  /**
   * Registra uma tentativa de pagamento para um pedido de forma atômica.
   * Valida a existência, propriedade e status pendente do pedido antes de concluir.
   * Comunica com o Gateway de Pagamento injetado para processar a cobrança.
   */
  async create(user: CurrentUserPayload, dto: CreatePaymentDto): Promise<Payment> {
    return await this.dataSource.transaction(async (manager) => {
      const paymentsRepo = manager.getRepository(Payment);
      const ordersRepo = manager.getRepository(Order);

      // 1. Validar se o pedido existe (carregar items para envio ao gateway)
      const order = await ordersRepo.findOne({
        where: { idPedido: dto.idPedido },
        relations: ['items'],
      });

      if (!order) {
        throw new NotFoundException(`Pedido com ID ${dto.idPedido} não foi encontrado.`);
      }

      // 2. Validar se o usuário é o dono do pedido (se for cliente)
      if (user.role === Role.CLIENTE && order.idUsuario !== user.sub) {
        throw new ForbiddenException(
          'Você não tem permissão para registrar pagamento para este pedido.',
        );
      }

      // 3. Validar status do pedido
      if (order.status === OrderStatus.PAID) {
        throw new ConflictException('O pedido já está pago.');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          `O pedido não está pendente de pagamento. Status atual: "${order.status}".`,
        );
      }

      // 4. Processar a cobrança no gateway de pagamento injetado
      const chargeResult = await this.paymentGateway.charge(
        Number(order.valorTotal),
        dto.captureMethod,
        dto.installments,
        order,
      );

      // 5. Criar o registro de pagamento baseado no retorno do gateway
      const payment = paymentsRepo.create({
        idPedido: order.idPedido,
        amount: Number(order.valorTotal),
        paidAmount: chargeResult.status === PaymentStatus.PAID ? Number(order.valorTotal) : null,
        captureMethod: dto.captureMethod,
        installments: dto.installments,
        status: chargeResult.status,
        orderNsu: chargeResult.orderNsu,
        transactionNsu: chargeResult.transactionNsu,
        invoiceSlug: chargeResult.invoiceSlug,
        receiptUrl: chargeResult.receiptUrl ?? null,
        redirectUrl: chargeResult.redirectUrl ?? null,
      });

      const savedPayment = await paymentsRepo.save(payment);

      // 6. Se aprovado imediatamente (ex.: gateway mock), marca o pedido como pago
      //    e dá baixa no estoque agora (a baixa não ocorre mais na criação do pedido).
      if (chargeResult.status === PaymentStatus.PAID) {
        await this.confirmPaidOrder(manager, order);
      }

      return savedPayment;
    });
  }

  /**
   * Consulta os detalhes do pagamento mais recente associado a um determinado pedido.
   * Restrito ao proprietário do pedido ou a funcionários (gerente/admin).
   */
  async findByOrder(user: CurrentUserPayload, idPedido: number): Promise<Payment> {
    const ordersRepo = this.dataSource.getRepository(Order);
    const paymentsRepo = this.dataSource.getRepository(Payment);

    // 1. Validar se o pedido existe
    const order = await ordersRepo.findOne({
      where: { idPedido },
    });

    if (!order) {
      throw new NotFoundException(`Pedido com ID ${idPedido} não foi encontrado.`);
    }

    // 2. Validar autorização
    if (user.role === Role.CLIENTE && order.idUsuario !== user.sub) {
      throw new ForbiddenException(
        'Você não tem permissão para consultar os pagamentos deste pedido.',
      );
    }

    // 3. Buscar o pagamento mais recente
    const payment = await paymentsRepo.findOne({
      where: { idPedido },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException(`Nenhum pagamento registrado para o pedido ${idPedido}.`);
    }

    return payment;
  }

  /**
   * Processa a notificação de Webhook enviada pela InfinitePay de forma assíncrona e atômica.
   * Se o pagamento for aprovado, atualiza a fatura e o status do pedido para 'paid'.
   * Se o pagamento falhar ou for cancelado, cancela o pedido e estorna os itens de volta ao estoque.
   */
  async handleWebhook(dto: InfinitePayWebhookDto, providedSecret?: string): Promise<void> {
    // 0. Autenticidade: só processa notificações que comprovadamente vêm do gateway.
    this.assertWebhookAuthentic(providedSecret);

    await this.dataSource.transaction(async (manager) => {
      const paymentsRepo = manager.getRepository(Payment);
      const ordersRepo = manager.getRepository(Order);

      // 1. Buscar o pagamento pelo NSU do pedido ou slug da fatura
      const payment = await paymentsRepo.findOne({
        where: [{ orderNsu: dto.order_nsu }, { invoiceSlug: dto.invoice_slug }],
        relations: ['order', 'order.items'],
      });

      if (!payment) {
        throw new NotFoundException(
          `Pagamento para o NSU "${dto.order_nsu}" ou Fatura "${dto.invoice_slug}" não foi encontrado.`,
        );
      }

      const order = payment.order;

      // 2. Idempotência + tolerância a notificações fora de ordem:
      //    - aprovação só age se ainda não estiver paga (e tem precedência);
      //    - falha só age enquanto o pagamento estiver pendente (não desfaz um pago).
      if (this.isApprovedNotification(dto)) {
        if (payment.status === PaymentStatus.PAID) {
          return;
        }
        payment.status = PaymentStatus.PAID;
        payment.paidAmount = dto.paid_amount
          ? parseFloat((dto.paid_amount / CENTS_PER_CURRENCY_UNIT).toFixed(2))
          : Number(payment.amount);
        if (dto.transaction_nsu) payment.transactionNsu = dto.transaction_nsu;
        if (dto.receipt_url) payment.receiptUrl = dto.receipt_url;
        await paymentsRepo.save(payment);

        await this.confirmPaidOrder(manager, order);
      } else if (this.isFailedNotification(dto)) {
        if (payment.status !== PaymentStatus.PENDING) {
          return;
        }
        payment.status = PaymentStatus.FAILED;
        await paymentsRepo.save(payment);

        order.status = OrderStatus.CANCELLED;
        await ordersRepo.save(order);
        // Sem estorno de estoque: a baixa só ocorre na confirmação do pagamento.
      }
    });
  }

  private isApprovedNotification(dto: InfinitePayWebhookDto): boolean {
    return (
      dto.status === 'approved' ||
      dto.status === 'paid' ||
      dto.event === 'payment.approved' ||
      (dto.paid_amount !== undefined && dto.paid_amount !== null && dto.paid_amount > 0)
    );
  }

  private isFailedNotification(dto: InfinitePayWebhookDto): boolean {
    return dto.status === 'failed' || dto.status === 'cancelled' || dto.status === 'expired';
  }

  /**
   * Reconcilia manualmente o pagamento de um pedido com o gateway (Gerente/Admin).
   * Útil para pedidos presos em "pending" cujo webhook não chegou: consulta o
   * status atual no gateway (quando suportado) e aplica o desfecho.
   */
  async reconcile(idPedido: number): Promise<Payment> {
    return await this.dataSource.transaction(async (manager) => {
      const paymentsRepo = manager.getRepository(Payment);

      const payment = await paymentsRepo.findOne({
        where: { idPedido },
        relations: ['order', 'order.items'],
        order: { createdAt: 'DESC' },
      });

      if (!payment) {
        throw new NotFoundException(`Nenhum pagamento registrado para o pedido ${idPedido}.`);
      }

      // Já resolvido (pago/falho/estornado): nada a reconciliar.
      if (payment.status !== PaymentStatus.PENDING) {
        return payment;
      }

      if (!this.paymentGateway.getStatus) {
        throw new ServiceUnavailableException(
          'O provedor de pagamento atual não suporta reconciliação automática.',
        );
      }

      const status = await this.paymentGateway.getStatus(payment);

      if (status === PaymentStatus.PAID) {
        payment.status = PaymentStatus.PAID;
        payment.paidAmount = Number(payment.amount);
        await paymentsRepo.save(payment);
        await this.confirmPaidOrder(manager, payment.order);
      } else if (status === PaymentStatus.FAILED) {
        payment.status = PaymentStatus.FAILED;
        await paymentsRepo.save(payment);
        payment.order.status = OrderStatus.CANCELLED;
        await manager.getRepository(Order).save(payment.order);
      }

      return payment;
    });
  }

  /** Marca o pedido como pago e dá baixa no estoque na mesma transação. */
  private async confirmPaidOrder(manager: EntityManager, order: Order): Promise<void> {
    order.status = OrderStatus.PAID;
    await manager.getRepository(Order).save(order);
    await this.debitOrderStock(manager, order);
  }

  /**
   * Dá baixa (pessimista) no estoque dos itens de um pedido pago e registra o log.
   * É aqui — e não na criação do pedido — que o estoque online/físico é decrementado.
   */
  private async debitOrderStock(manager: EntityManager, order: Order): Promise<void> {
    const stockRepo = manager.getRepository(Stock);
    const stockLogRepo = manager.getRepository(StockLog);

    for (const item of order.items) {
      const stock = await stockRepo.findOne({
        where: { codigoSku: item.idVariante },
        lock: { mode: 'pessimistic_write' },
      });

      const disponivel = stock
        ? order.tipoRetirada === TipoRetirada.LOJA
          ? stock.qtdLojaFisica
          : stock.qtdOnline
        : 0;

      if (!stock || disponivel < item.quantidade) {
        throw new ConflictException(
          `Estoque insuficiente para a variante "${item.idVariante}" ao confirmar o pagamento. ` +
            `Disponível: ${disponivel}, Solicitado: ${item.quantidade}`,
        );
      }

      const anteriorOnline = stock.qtdOnline;
      const anteriorLoja = stock.qtdLojaFisica;

      if (order.tipoRetirada === TipoRetirada.LOJA) {
        stock.qtdLojaFisica -= item.quantidade;
      } else {
        stock.qtdOnline -= item.quantidade;
      }

      await stockRepo.save(stock);

      const log = stockLogRepo.create({
        codigoSku: item.idVariante,
        idPedido: order.idPedido,
        tipoMovimentacao: MovementType.VENDA,
        quantidadeMovimentada: item.quantidade,
        valorAnteriorOnline: anteriorOnline,
        valorNovoOnline: stock.qtdOnline,
        valorAnteriorLoja: anteriorLoja,
        valorNovoLoja: stock.qtdLojaFisica,
        origem: 'pagamento_confirmado',
        motivo: 'Baixa de estoque na confirmação do pagamento',
      });
      await stockLogRepo.save(log);
    }
  }

  /**
   * Garante a autenticidade do webhook. Em produção exige
   * `INFINITEPAY_WEBHOOK_SECRET`; em dev/test, sem segredo configurado, apenas
   * registra um aviso e permite — para não travar o ambiente local e os testes.
   */
  private assertWebhookAuthentic(providedSecret?: string): void {
    const secret = process.env.INFINITEPAY_WEBHOOK_SECRET;

    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'Webhook de pagamento não configurado: defina INFINITEPAY_WEBHOOK_SECRET.',
        );
      }
      this.logger.warn(
        'INFINITEPAY_WEBHOOK_SECRET não definido — webhook aceito sem validação (apenas fora de produção).',
      );
      return;
    }

    const provided = Buffer.from(providedSecret ?? '');
    const expected = Buffer.from(secret);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Assinatura/segredo do webhook inválido.');
    }
  }
}
