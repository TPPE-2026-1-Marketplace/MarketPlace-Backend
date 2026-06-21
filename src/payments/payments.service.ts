import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
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

      // 6. Atualizar status do pedido para paid (se o pagamento foi aprovado imediatamente)
      if (chargeResult.status === PaymentStatus.PAID) {
        order.status = OrderStatus.PAID;
        await ordersRepo.save(order);
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
  async handleWebhook(dto: InfinitePayWebhookDto): Promise<void> {
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

      // 2. Idempotência: Se já estiver aprovado/pago, ignorar notificações duplicadas
      if (payment.status === PaymentStatus.PAID) {
        return;
      }

      const order = payment.order;

      if (this.isApprovedNotification(dto)) {
        // 3. Atualizar pagamento e pedido para PAID
        payment.status = PaymentStatus.PAID;
        payment.paidAmount = dto.paid_amount
          ? parseFloat((dto.paid_amount / CENTS_PER_CURRENCY_UNIT).toFixed(2))
          : Number(payment.amount);
        if (dto.transaction_nsu) payment.transactionNsu = dto.transaction_nsu;
        if (dto.receipt_url) payment.receiptUrl = dto.receipt_url;

        await paymentsRepo.save(payment);

        order.status = OrderStatus.PAID;
        await ordersRepo.save(order);
      } else if (this.isFailedNotification(dto)) {
        // 4. Se falhar ou expirar, marcar como falho, cancelar pedido e estornar o estoque
        payment.status = PaymentStatus.FAILED;
        await paymentsRepo.save(payment);

        order.status = OrderStatus.CANCELLED;
        await ordersRepo.save(order);

        await this.revertOrderStock(manager, order);
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

  /** Estorna ao estoque (de forma pessimista) os itens de um pedido cancelado e registra o log. */
  private async revertOrderStock(manager: EntityManager, order: Order): Promise<void> {
    const stockRepo = manager.getRepository(Stock);
    const stockLogRepo = manager.getRepository(StockLog);

    for (const item of order.items) {
      const stock = await stockRepo.findOne({
        where: { codigoSku: item.idVariante },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stock) continue;

      const anteriorOnline = stock.qtdOnline;
      const anteriorLoja = stock.qtdLojaFisica;

      if (order.tipoRetirada === TipoRetirada.LOJA) {
        stock.qtdLojaFisica += item.quantidade;
      } else {
        stock.qtdOnline += item.quantidade;
      }

      await stockRepo.save(stock);

      const log = stockLogRepo.create({
        codigoSku: item.idVariante,
        idPedido: order.idPedido,
        tipoMovimentacao: MovementType.ENTRADA,
        quantidadeMovimentada: item.quantidade,
        valorAnteriorOnline: anteriorOnline,
        valorNovoOnline: stock.qtdOnline,
        valorAnteriorLoja: anteriorLoja,
        valorNovoLoja: stock.qtdLojaFisica,
        origem: 'infinitepay_webhook',
        motivo: 'Estorno por cancelamento ou falha de pagamento no checkout InfinitePay',
      });
      await stockLogRepo.save(log);
    }
  }
}
