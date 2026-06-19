import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Order } from './order.entity';
import { CreateOrderDto } from './create-order.dto';

@Injectable()
export class OrdersService {
  private static readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const orderData: DeepPartial<Order> = {
      subtotal: dto.subtotal,
      frete: dto.frete ?? 0,
      desconto: dto.desconto ?? 0,
      total: dto.total,
      payment_method: dto.paymentMethod,
      status: 'pendente',
      cliente_nome: dto.cliente?.nome ?? undefined,
      cliente_email: dto.cliente?.email ?? undefined,
      cliente_cpf: dto.cliente?.cpf ?? undefined,
      cliente_telefone: dto.cliente?.telefone ?? undefined,
      endereco_cep: dto.endereco?.cep ?? undefined,
      endereco_rua: dto.endereco?.rua ?? undefined,
      endereco_numero: dto.endereco?.numero ?? undefined,
      endereco_complemento: dto.endereco?.complemento ?? undefined,
      endereco_bairro: dto.endereco?.bairro ?? undefined,
      endereco_cidade: dto.endereco?.cidade ?? undefined,
      endereco_estado: dto.endereco?.estado ?? undefined,
    };

    const order = this.ordersRepository.create(orderData);
    const saved = await this.ordersRepository.save(order);
    OrdersService.logger.log(`Pedido #${saved.id_pedido} criado — total: R$${dto.total}`);
    return saved;
  }

  async findAll(): Promise<Order[]> {
    return this.ordersRepository.find({ order: { id_pedido: 'DESC' } });
  }

  async findOne(id: number): Promise<Order | null> {
    return this.ordersRepository.findOne({ where: { id_pedido: id } });
  }
}
