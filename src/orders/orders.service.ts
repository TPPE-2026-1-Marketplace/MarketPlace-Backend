import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Repository, Between } from 'typeorm';

import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus, TipoRetirada } from './entities/order.entity';
import { CouponsService } from '../coupons/coupons.service';
import { PeopleService } from '../people/people.service';
import { ConfirmPickupDto } from './dtos/confirm-pickup.dto';
import { CreateInStoreOrderDto } from './dtos/create-in-store-order.dto';
import { CreateOrderDto } from './dtos/create-order.dto';
import { ListOrdersQueryDto } from './dtos/list-orders-query.dto';
import { UpdateTrackingDto } from './dtos/update-tracking.dto';
import {
  PERCENTAGE_MAX,
  VERIFICATION_CODE_MIN,
  VERIFICATION_CODE_RANGE,
} from '../common/constants';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { getMonthDateRange } from '../common/utils';
import { Coupon } from '../coupons/entities/coupon.entity';
import { Employee } from '../employees/entities/employee.entity';
import { StockLog, MovementType } from '../inventory/entities/stock-log.entity';
import { Stock } from '../inventory/entities/stock.entity';
import { Person } from '../people/entities/person.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(ProductVariant)
    private readonly productVariantsRepository: Repository<ProductVariant>,
    private readonly couponsService: CouponsService,
    private readonly peopleService: PeopleService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Processamento e criação do pedido (Checkout Online).
   * Executa todo o fluxo de verificação de estoque, alteração de saldos,
   * cálculo de totais, cupons e gravação de logs de estoque de forma atômica.
   */
  // eslint-disable-next-line max-lines-per-function
  async create(idUsuario: string, dto: CreateOrderDto): Promise<Order> {
    // eslint-disable-next-line complexity, max-lines-per-function -- lógica transacional: validação e persistência na mesma transação
    return await this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const orderItemsRepo = manager.getRepository(OrderItem);
      const productVariantsRepo = manager.getRepository(ProductVariant);
      const stockRepo = manager.getRepository(Stock);
      const stockLogRepo = manager.getRepository(StockLog);

      // 1. Validar se o cliente existe (retorna 404 se não existir)
      const clientExists = await manager.findOne(Person, {
        where: { cpf: idUsuario },
      });
      if (!clientExists) {
        throw new NotFoundException(`Cliente com CPF "${idUsuario}" não encontrado.`);
      }

      // 2. Coletar SKUs das variantes do pedido
      const skus = dto.items.map((item) => item.variantSku);

      // 3. Buscar todas as variantes no banco de dados, incluindo a relação product
      const variants = await productVariantsRepo.find({
        where: { codigoSku: In(skus) },
        relations: ['product'],
      });

      const variantsMap = new Map(variants.map((v) => [v.codigoSku, v]));

      // 4. Validar se todas as variantes passadas de fato existem no banco e estão ativas
      for (const item of dto.items) {
        const variant = variantsMap.get(item.variantSku);
        if (!variant) {
          throw new NotFoundException(
            `Variante de produto com SKU "${item.variantSku}" não foi encontrada no catálogo.`,
          );
        }
        if (!variant.ativo) {
          throw new BadRequestException(
            `A variante de produto com SKU "${item.variantSku}" está inativa e não pode ser vendida.`,
          );
        }
      }

      // 5. Bloquear pessimistamente e carregar as entidades de estoque para os SKUs envolvidos
      // Isso impede condições de corrida e garante concorrência atômica segura no banco.
      const stocks = await stockRepo.find({
        where: { codigoSku: In(skus) },
        lock: { mode: 'pessimistic_write' },
      });
      const stocksMap = new Map(stocks.map((s) => [s.codigoSku, s]));

      // 6. Verificar estoque e decrementar baseado no tipo de retirada
      const stockUpdates: Stock[] = [];
      const stockLogTemplates: Array<{
        codigoSku: string;
        quantidadeMovimentada: number;
        valorAnteriorOnline: number;
        valorNovoOnline: number;
        valorAnteriorLoja: number;
        valorNovoLoja: number;
        origem: string;
        motivo: string;
      }> = [];

      for (const item of dto.items) {
        let stock = stocksMap.get(item.variantSku);
        if (!stock) {
          // Se não existir registro de estoque ainda para o SKU, inicializamos zerado
          stock = stockRepo.create({
            codigoSku: item.variantSku,
            qtdOnline: 0,
            qtdLojaFisica: 0,
          });
        }

        const anteriorOnline = stock.qtdOnline;
        const anteriorLoja = stock.qtdLojaFisica;

        if (dto.tipoRetirada === TipoRetirada.LOJA) {
          // Retirada em Loja Física -> Decrementar estoque da Loja Física
          if (stock.qtdLojaFisica < item.quantidade) {
            throw new ConflictException(
              `Estoque físico insuficiente para a variante "${item.variantSku}". Disponível: ${stock.qtdLojaFisica}, Solicitado: ${item.quantidade}`,
            );
          }
          stock.qtdLojaFisica -= item.quantidade;
        } else {
          // Entrega em domicílio -> Decrementar estoque Online
          if (stock.qtdOnline < item.quantidade) {
            throw new ConflictException(
              `Estoque online insuficiente para a variante "${item.variantSku}". Disponível: ${stock.qtdOnline}, Solicitado: ${item.quantidade}`,
            );
          }
          stock.qtdOnline -= item.quantidade;
        }

        stockUpdates.push(stock);

        stockLogTemplates.push({
          codigoSku: item.variantSku,
          quantidadeMovimentada: item.quantidade,
          valorAnteriorOnline: anteriorOnline,
          valorNovoOnline: stock.qtdOnline,
          valorAnteriorLoja: anteriorLoja,
          valorNovoLoja: stock.qtdLojaFisica,
          origem: 'checkout_online',
          motivo: `Venda pelo pedido de ${dto.tipoRetirada === TipoRetirada.LOJA ? 'retirada física' : 'entrega'}`,
        });
      }

      // Persistir as atualizações de estoque decrementado
      await stockRepo.save(stockUpdates);

      // 7. Calcular subtotal somando precoVariante * quantidade
      let subtotal = 0;
      for (const item of dto.items) {
        const variant = variantsMap.get(item.variantSku)!;
        subtotal += Number(variant.precoVariante) * item.quantidade;
      }

      // 8. Aplicar cupom se válido de forma 100% segura com bloqueio pessimista
      let valorDesconto = 0;
      if (dto.couponNumero) {
        valorDesconto = await this.applyCouponTransactional(
          manager,
          dto.couponNumero,
          variants,
          subtotal,
        );
      }

      // Arredondar os valores para evitar dízimas periódicas no banco de dados
      subtotal = parseFloat(subtotal.toFixed(2));

      // Regra de Frete
      let valorFrete = 0;
      let codigoVerificacaoRetirada: string | null = null;

      if (dto.tipoRetirada === TipoRetirada.LOJA) {
        valorFrete = 0;
        // Gerar código de verificação de 6 dígitos
        codigoVerificacaoRetirada = Math.floor(
          VERIFICATION_CODE_MIN + Math.random() * VERIFICATION_CODE_RANGE,
        ).toString();
      } else {
        valorFrete = parseFloat(dto.valorFrete.toFixed(2));
      }

      valorDesconto = parseFloat(valorDesconto.toFixed(2));

      // Total final do pedido
      const valorTotalRaw = subtotal + valorFrete - valorDesconto;
      const valorTotal = parseFloat(Math.max(0, valorTotalRaw).toFixed(2));

      // 9. Persistir o pedido principal
      const order = ordersRepo.create({
        idUsuario,
        idCupom: dto.couponNumero ? dto.couponNumero.toUpperCase().trim() : null,
        subtotal,
        valorFrete,
        valorTotal,
        tipoRetirada: dto.tipoRetirada,
        codigoVerificacaoRetirada,
        status: OrderStatus.PENDING,
      });

      // Criar os itens de pedido correspondentes (cascade save)
      order.items = dto.items.map((item) => {
        const variant = variantsMap.get(item.variantSku)!;
        return orderItemsRepo.create({
          idVariante: item.variantSku,
          quantidade: item.quantidade,
          precoUnitario: Number(variant.precoVariante),
        });
      });

      // Gravar pedido e obter ID persistido
      const savedOrder = await ordersRepo.save(order);

      // 10. Criar logs de movimentação de estoque referenciando o idPedido criado
      const stockLogs = stockLogTemplates.map((log) => {
        return stockLogRepo.create({
          ...log,
          tipoMovimentacao: MovementType.VENDA,
          idPedido: savedOrder.idPedido,
        });
      });

      await stockLogRepo.save(stockLogs);

      return savedOrder;
    });
  }

  /**
   * Registra uma Venda Presencial no caixa (US24).
   * Executa todo o fluxo de validação de vendedor, cliente opcional,
   * cálculo de totais, cupons e redução do estoque físico de forma atômica.
   */
  // eslint-disable-next-line max-lines-per-function
  async createInStore(dto: CreateInStoreOrderDto): Promise<Order> {
    // eslint-disable-next-line complexity, max-lines-per-function -- lógica transacional: validação e persistência na mesma transação
    return await this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const orderItemsRepo = manager.getRepository(OrderItem);
      const productVariantsRepo = manager.getRepository(ProductVariant);
      const stockRepo = manager.getRepository(Stock);
      const stockLogRepo = manager.getRepository(StockLog);

      // 1. Validar se o funcionário/vendedor associado existe e possui perfil correto
      const seller = await manager.findOne(Employee, {
        where: [{ cpf: dto.codigoVendedor }, { codigo_funcionario: dto.codigoVendedor }],
      });

      if (!seller) {
        throw new BadRequestException(
          `Funcionário com código/CPF "${dto.codigoVendedor}" não foi encontrado.`,
        );
      }

      if (!seller.ativo) {
        throw new BadRequestException(
          `O funcionário "${seller.person?.nome || seller.cpf}" está inativo.`,
        );
      }

      if (
        seller.role_perfil !== Role.VENDEDOR &&
        seller.role_perfil !== Role.CAIXA &&
        seller.role_perfil !== Role.GERENTE &&
        seller.role_perfil !== Role.ADMINISTRADOR
      ) {
        throw new BadRequestException(
          `O funcionário "${seller.person?.nome || seller.cpf}" não possui permissão para registrar vendas (role: "${seller.role_perfil}").`,
        );
      }

      // 2. Se o CPF do cliente foi informado, verificar se já está cadastrado
      let clienteCpfAvulso: string | null = null;
      let idUsuarioFinal: string | null = null;

      if (dto.idUsuario) {
        const clientExists = await manager.findOne(Person, {
          where: { cpf: dto.idUsuario },
        });
        if (clientExists) {
          // Cliente cadastrado → vincular via FK
          idUsuarioFinal = dto.idUsuario;
        } else {
          // Cliente não cadastrado → salvar CPF no campo avulso (sem FK)
          clienteCpfAvulso = dto.idUsuario;
        }
      }

      // 3. Coletar SKUs das variantes da venda
      const skus = dto.items.map((item) => item.variantSku);

      // 4. Buscar variantes no banco
      const variants = await productVariantsRepo.find({
        where: { codigoSku: In(skus) },
        relations: ['product'],
      });

      const variantsMap = new Map(variants.map((v) => [v.codigoSku, v]));

      // Validar existência e status ativo das variantes (retorna 404 se ausente)
      for (const item of dto.items) {
        const variant = variantsMap.get(item.variantSku);
        if (!variant) {
          throw new NotFoundException(
            `Variante com SKU "${item.variantSku}" não foi encontrada no catálogo.`,
          );
        }
        if (!variant.ativo) {
          throw new BadRequestException(
            `A variante com SKU "${item.variantSku}" está inativa e não pode ser vendida.`,
          );
        }
      }

      // 5. Bloquear pessimistamente e carregar estoques físicos envolvidos
      const stocks = await stockRepo.find({
        where: { codigoSku: In(skus) },
        lock: { mode: 'pessimistic_write' },
      });
      const stocksMap = new Map(stocks.map((s) => [s.codigoSku, s]));

      const stockUpdates: Stock[] = [];
      const stockLogTemplates: Array<{
        codigoSku: string;
        quantidadeMovimentada: number;
        valorAnteriorOnline: number;
        valorNovoOnline: number;
        valorAnteriorLoja: number;
        valorNovoLoja: number;
        origem: string;
        motivo: string;
      }> = [];

      // 6. Verificar e decrementar estoque físico da loja
      for (const item of dto.items) {
        let stock = stocksMap.get(item.variantSku);
        if (!stock) {
          stock = stockRepo.create({
            codigoSku: item.variantSku,
            qtdOnline: 0,
            qtdLojaFisica: 0,
          });
        }

        const anteriorOnline = stock.qtdOnline;
        const anteriorLoja = stock.qtdLojaFisica;

        // Venda Presencial SEMPRE decrementa qtdLojaFisica
        if (stock.qtdLojaFisica < item.quantidade) {
          throw new ConflictException(
            `Estoque físico insuficiente na loja para a variante "${item.variantSku}". Disponível: ${stock.qtdLojaFisica}, Solicitado: ${item.quantidade}`,
          );
        }
        stock.qtdLojaFisica -= item.quantidade;
        stockUpdates.push(stock);

        stockLogTemplates.push({
          codigoSku: item.variantSku,
          quantidadeMovimentada: item.quantidade,
          valorAnteriorOnline: anteriorOnline,
          valorNovoOnline: stock.qtdOnline,
          valorAnteriorLoja: anteriorLoja,
          valorNovoLoja: stock.qtdLojaFisica,
          origem: 'venda_presencial',
          motivo: `Venda registrada no caixa pelo funcionário ${seller.cpf}`,
        });
      }

      // Salvar estoques
      await stockRepo.save(stockUpdates);

      // 7. Calcular subtotal
      let subtotal = 0;
      for (const item of dto.items) {
        const variant = variantsMap.get(item.variantSku)!;
        subtotal += Number(variant.precoVariante) * item.quantidade;
      }

      // 8. Aplicar cupom se válido de forma 100% segura com bloqueio pessimista
      let valorDesconto = 0;
      if (dto.couponNumero) {
        valorDesconto = await this.applyCouponTransactional(
          manager,
          dto.couponNumero,
          variants,
          subtotal,
        );
      }

      subtotal = parseFloat(subtotal.toFixed(2));
      valorDesconto = parseFloat(valorDesconto.toFixed(2));

      // Total final (Frete é SEMPRE zero na venda física)
      const valorTotalRaw = subtotal - valorDesconto;
      const valorTotal = parseFloat(Math.max(0, valorTotalRaw).toFixed(2));

      // 9. Criar o pedido (Venda Presencial)
      const order = ordersRepo.create({
        idUsuario: idUsuarioFinal,
        clienteCpfAvulso,
        clienteNomeAvulso: dto.clienteNomeAvulso ?? null,
        idCupom: dto.couponNumero ? dto.couponNumero.toUpperCase().trim() : null,
        subtotal,
        valorFrete: 0,
        valorTotal,
        tipoRetirada: TipoRetirada.LOJA, // Sempre retirada física
        codigoVerificacaoRetirada: null, // Sem PIN de retirada
        status: OrderStatus.PAID, // Inicializa como PAGO
        idFuncionario: seller.cpf, // Vendedor associado
      });

      // Itens cascade
      order.items = dto.items.map((item) => {
        const variant = variantsMap.get(item.variantSku)!;
        return orderItemsRepo.create({
          idVariante: item.variantSku,
          quantidade: item.quantidade,
          precoUnitario: Number(variant.precoVariante),
        });
      });

      const savedOrder = await ordersRepo.save(order);

      // 10. Gravar StockLogs
      const stockLogs = stockLogTemplates.map((log) => {
        return stockLogRepo.create({
          ...log,
          tipoMovimentacao: MovementType.VENDA,
          idPedido: savedOrder.idPedido,
        });
      });

      await stockLogRepo.save(stockLogs);

      return savedOrder;
    });
  }

  /**
   * Insere manualmente o código de rastreamento de frete (US18).
   * Altera status do pedido para 'shipped' se tipoRetirada for 'entrega'.
   */
  async updateTracking(idPedido: number, dto: UpdateTrackingDto): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { idPedido },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Pedido com ID ${idPedido} não foi encontrado.`);
    }

    if (order.tipoRetirada !== TipoRetirada.ENTREGA) {
      throw new BadRequestException(
        'Pedido com retirada na loja não aceita código de rastreamento.',
      );
    }

    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException(
        `O código de rastreamento só pode ser inserido em pedidos pagos ou já enviados. Status atual: "${order.status}".`,
      );
    }

    order.codigoRastreamento = dto.codigo_rastreamento;
    order.status = OrderStatus.SHIPPED;

    return await this.ordersRepository.save(order);
  }

  /**
   * Consulta os detalhes de um pedido.
   * Apenas o dono do pedido (cliente) ou funcionários autorizados têm acesso.
   */
  async findOne(idPedido: number, user: CurrentUserPayload): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { idPedido },
      relations: ['items', 'items.variant'],
    });

    if (!order) {
      throw new NotFoundException(`Pedido com ID ${idPedido} não foi encontrado.`);
    }

    // Se for cliente, deve ser o dono do pedido
    if (user.role === Role.CLIENTE) {
      if (order.idUsuario !== user.sub) {
        throw new ForbiddenException('Você não possui autorização para consultar este pedido.');
      }
    }

    return order;
  }

  /**
   * Busca o código de verificação de retirada do pedido.
   * Apenas o dono do pedido (cliente correspondente) ou funcionários têm acesso.
   */
  async getVerificationCode(
    idPedido: number,
    user: CurrentUserPayload,
  ): Promise<{ codigoVerificacaoRetirada: string }> {
    const order = await this.ordersRepository.findOne({
      where: { idPedido },
    });

    if (!order) {
      throw new NotFoundException(`Pedido com ID ${idPedido} não foi encontrado.`);
    }

    if (order.tipoRetirada !== TipoRetirada.LOJA) {
      throw new BadRequestException(
        'Este pedido não está configurado para retirada na loja física.',
      );
    }

    // Se o usuário for cliente, deve ser o dono do pedido
    if (user.role === Role.CLIENTE) {
      if (order.idUsuario !== user.sub) {
        throw new ForbiddenException(
          'Você não possui autorização para visualizar o código de retirada deste pedido.',
        );
      }
    }

    return {
      codigoVerificacaoRetirada: order.codigoVerificacaoRetirada!,
    };
  }

  /**
   * Confirma a retirada física de um pedido pelo cliente via validação do PIN (US15).
   * Altera status do pedido para 'delivered' se tipoRetirada for 'loja' e o pedido estiver pago.
   */
  async confirmPickup(idPedido: number, dto: ConfirmPickupDto): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { idPedido },
    });

    if (!order) {
      throw new NotFoundException(`Pedido com ID ${idPedido} não foi encontrado.`);
    }

    if (order.tipoRetirada !== TipoRetirada.LOJA) {
      throw new BadRequestException(
        'Este pedido não está configurado para retirada na loja física.',
      );
    }

    // Idempotência: se a retirada já foi confirmada, retornar sem erro
    if (order.status === OrderStatus.DELIVERED) {
      return order;
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        `A retirada só pode ser confirmada para pedidos pagos. Status atual: "${order.status}".`,
      );
    }

    if (order.codigoVerificacaoRetirada !== dto.pin) {
      throw new BadRequestException('O PIN de verificação de retirada informado está incorreto.');
    }

    order.status = OrderStatus.DELIVERED;
    return await this.ordersRepository.save(order);
  }

  /**
   * Lista pedidos paginados com filtros opcionais (Gerente/Admin).
   */
  async findAll(query: ListOrdersQueryDto): Promise<{
    data: Order[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page, limit, status, tipoRetirada } = query;
    const where: FindOptionsWhere<Order> = {};
    if (status) where.status = status;
    if (tipoRetirada) where.tipoRetirada = tipoRetirada;

    const [data, total] = await this.ordersRepository.findAndCount({
      where,
      relations: ['items', 'user', 'employee', 'employee.person'],
      order: { dataPedido: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Lista os pedidos do próprio cliente autenticado, paginados.
   */
  async findAllByUser(
    idUsuario: string,
    query: ListOrdersQueryDto,
  ): Promise<{
    data: Order[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page, limit, status } = query;
    const where: FindOptionsWhere<Order> = { idUsuario };
    if (status) where.status = status;

    const [data, total] = await this.ordersRepository.findAndCount({
      where,
      relations: ['items', 'user', 'employee', 'employee.person'],
      order: { dataPedido: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Método privado reutilizável para validar e aplicar um cupom dentro de uma transação.
   * Valida ativo, vigência, limite de uso e elegibilidade de produtos.
   * Incrementa usosAtuais e retorna o valorDesconto calculado.
   */
  // eslint-disable-next-line complexity
  private async applyCouponTransactional(
    manager: EntityManager,
    couponNumero: string,
    variants: ProductVariant[],
    subtotal: number,
  ): Promise<number> {
    const normalizedCoupon = couponNumero.toUpperCase().trim();
    const coupon = await manager.findOne(Coupon, {
      where: { numeroDoCupom: normalizedCoupon },
      lock: { mode: 'pessimistic_write' },
    });

    if (!coupon || !coupon.ativo) {
      throw new BadRequestException('Cupom inválido. Motivo: invalid');
    }

    const now = new Date();
    if (now < coupon.dataInicio || now > coupon.dataFim) {
      throw new BadRequestException('Cupom inválido. Motivo: expired');
    }

    if (coupon.usoMaximo !== null && coupon.usosAtuais >= coupon.usoMaximo) {
      throw new BadRequestException('Cupom inválido. Motivo: limit_reached');
    }

    // Carregar relação N:N de produtos sem JOIN na query travada (evita deadlock)
    coupon.products = await manager
      .createQueryBuilder()
      .relation(Coupon, 'products')
      .of(coupon)
      .loadMany();

    // Verificar elegibilidade de produtos se o cupom for restrito
    if (coupon.products && coupon.products.length > 0) {
      const productIds = variants.map((v) => v.product.idProduto);
      const couponProductIds = coupon.products.map((p) => p.idProduto);
      const isEligible = productIds.some((id) => couponProductIds.includes(id));
      if (!isEligible) {
        throw new BadRequestException('Cupom inválido. Motivo: ineligible_products');
      }
    }

    // Calcular desconto conforme tipo
    let valorDesconto = 0;
    if (coupon.tipoCupom === 'fixo') {
      valorDesconto = Number(coupon.valorDesconto);
    } else if (coupon.tipoCupom === 'porcentagem') {
      valorDesconto = subtotal * (Number(coupon.valorDesconto) / PERCENTAGE_MAX);
    }

    // Incrementar usos de forma atômica dentro da transação
    coupon.usosAtuais += 1;
    await manager.save(coupon);

    return valorDesconto;
  }

  /**
   * Busca todas as vendas presenciais de um vendedor em um determinado mês e ano.
   * Filtra apenas pedidos pagos, enviados ou entregues.
   */
  async findInStoreOrdersByEmployeeAndPeriod(
    cpf: string,
    mes: number,
    ano: number,
  ): Promise<Order[]> {
    const { startDate, endDate } = getMonthDateRange(ano, mes);

    return await this.ordersRepository.find({
      where: {
        idFuncionario: cpf,
        status: In([OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED]),
        tipoRetirada: TipoRetirada.LOJA,
        dataPedido: Between(startDate, endDate),
      },
    });
  }

  /**
   * Calcula o valor total acumulado de todas as vendas presenciais da loja em um mês e ano (Administrador).
   */
  async sumTotalInStoreSalesByPeriod(mes: number, ano: number): Promise<number> {
    const { startDate, endDate } = getMonthDateRange(ano, mes);

    const result = await this.ordersRepository
      .createQueryBuilder('order')
      .select('SUM(order.valorTotal)', 'sum')
      .where('order.status IN (:...statuses)', {
        statuses: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
      })
      .andWhere('order.tipoRetirada = :type', { type: TipoRetirada.LOJA })
      .andWhere('order.dataPedido BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    return parseFloat(Number(result?.sum ?? 0).toFixed(2));
  }
}
