import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';

export enum MovementType {
  ENTRADA = 'entrada',
  SAIDA = 'saida',
  AJUSTE = 'ajuste',
  VENDA = 'venda',
}

@Entity()
export class StockLog {
  @PrimaryGeneratedColumn()
  idLog: number;

  @Column({ type: 'varchar', length: 40 })
  codigoSku: string;

  @Column({ type: 'int', nullable: true })
  idPedido: number | null;

  @Column({ type: 'enum', enum: MovementType })
  tipoMovimentacao: MovementType;

  @Column({ type: 'int' })
  quantidadeMovimentada: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  dataCriacao: Date;

  @Column({ type: 'int', nullable: true })
  valorAnteriorOnline: number | null;

  @Column({ type: 'int', nullable: true })
  valorNovoOnline: number | null;

  @Column({ type: 'int', nullable: true })
  valorAnteriorLoja: number | null;

  @Column({ type: 'int', nullable: true })
  valorNovoLoja: number | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  origem: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo: string | null;

  @ManyToOne(() => ProductVariant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'codigo_sku', referencedColumnName: 'codigoSku' })
  variant: ProductVariant;
}
