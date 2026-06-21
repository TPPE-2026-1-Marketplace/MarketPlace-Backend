import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export interface OrderItem {
  productId: number;
  variantId: number;
  titulo: string;
  tamanho?: string;
  cor?: string;
  quantidade: number;
  preco_unitario: number;
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id_pedido: number;

  @Column('jsonb', { default: () => "'[]'" })
  items: OrderItem[];

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  frete: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  desconto: number | null;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column()
  payment_method: string;

  @Column({ default: 'pendente' })
  status: string;

  @Column({ nullable: true, type: 'varchar' })
  cliente_nome: string | null;

  @Column({ nullable: true, type: 'varchar' })
  cliente_email: string | null;

  @Column({ nullable: true, type: 'varchar' })
  cliente_cpf: string | null;

  @Column({ nullable: true, type: 'varchar' })
  cliente_telefone: string | null;

  @Column({ nullable: true, type: 'varchar' })
  endereco_cep: string | null;

  @Column({ nullable: true, type: 'varchar' })
  endereco_rua: string | null;

  @Column({ nullable: true, type: 'varchar' })
  endereco_numero: string | null;

  @Column({ nullable: true, type: 'varchar' })
  endereco_complemento: string | null;

  @Column({ nullable: true, type: 'varchar' })
  endereco_bairro: string | null;

  @Column({ nullable: true, type: 'varchar' })
  endereco_cidade: string | null;

  @Column({ nullable: true, type: 'varchar' })
  endereco_estado: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
