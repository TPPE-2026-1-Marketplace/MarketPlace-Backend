import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm';

import { OrderItem } from './order-item.entity';
import { Coupon } from '../../coupons/entities/coupon.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Person } from '../../people/entities/person.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum TipoRetirada {
  ENTREGA = 'entrega',
  LOJA = 'loja',
}

/**
 * Entidade Order (Pedido)
 *
 * Mapeia a tabela `orders` no banco de dados.
 * Inclui todas as FKs para Person, Coupon, Employee e a lista de OrderItems.
 */
@Entity('orders')
@Check(`"subtotal" >= 0`)
@Check(`"valor_frete" >= 0`)
@Check(`"valor_total" >= 0`)
@Index(['idFuncionario', 'tipoRetirada', 'status', 'dataPedido'])
export class Order {
  @PrimaryGeneratedColumn({ name: 'id_pedido' })
  idPedido: number;

  @Index()
  @Column({ name: 'id_usuario', type: 'varchar', length: 11, nullable: true })
  idUsuario: string | null;

  @ManyToOne(() => Person, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario', referencedColumnName: 'cpf' })
  user: Person | null;

  @Column({ name: 'cliente_nome_avulso', type: 'varchar', length: 150, nullable: true })
  clienteNomeAvulso: string | null;

  @Column({ name: 'cliente_cpf_avulso', type: 'varchar', length: 11, nullable: true })
  clienteCpfAvulso: string | null;

  @Index()
  @Column({ name: 'id_cupom', type: 'varchar', length: 50, nullable: true })
  idCupom: string | null;

  @ManyToOne(() => Coupon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_cupom', referencedColumnName: 'numeroDoCupom' })
  coupon: Coupon | null;

  @CreateDateColumn({ name: 'data_pedido', type: 'timestamp' })
  dataPedido: Date;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ name: 'valor_frete', type: 'decimal', precision: 12, scale: 2 })
  valorFrete: number;

  @Column({ name: 'valor_total', type: 'decimal', precision: 12, scale: 2 })
  valorTotal: number;

  @Column({
    name: 'tipo_retirada',
    type: 'enum',
    enum: TipoRetirada,
  })
  tipoRetirada: TipoRetirada;

  @Index()
  @Column({ name: 'codigo_verificacao_retirada', type: 'varchar', length: 50, nullable: true })
  codigoVerificacaoRetirada: string | null;

  @Index()
  @Column({ name: 'id_funcionario', type: 'varchar', length: 11, nullable: true })
  idFuncionario: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_funcionario', referencedColumnName: 'cpf' })
  employee: Employee | null;

  @Column({ name: 'codigo_rastreamento', type: 'varchar', length: 100, nullable: true })
  codigoRastreamento: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];
}
