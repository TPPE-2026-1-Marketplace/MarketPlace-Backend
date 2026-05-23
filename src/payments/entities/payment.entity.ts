import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';

import { Order } from '../../orders/entities/order.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum CaptureMethod {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
}

/**
 * Entidade Payment (Pagamento)
 *
 * Mapeia a tabela `payment` no banco de dados.
 * Representa os registros de pagamento de um determinado pedido.
 */
@Entity()
@Check(`"amount" >= 0`)
@Check(`"paid_amount" IS NULL OR "paid_amount" >= 0`)
@Check(`"installments" >= 1`)
export class Payment {
  @PrimaryGeneratedColumn({ name: 'id_pagamento' })
  idPagamento: number;

  @Column({ name: 'id_pedido', type: 'integer' })
  idPedido: number;

  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido', referencedColumnName: 'idPedido' })
  order: Order;

  @Column({ name: 'order_nsu', type: 'varchar', nullable: true })
  orderNsu: string | null;

  @Column({ name: 'transaction_nsu', type: 'varchar', nullable: true })
  transactionNsu: string | null;

  @Column({ name: 'invoice_slug', type: 'varchar', nullable: true })
  invoiceSlug: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  paidAmount: number | null;

  @Column({ type: 'integer', default: 1 })
  installments: number;

  @Column({
    name: 'capture_method',
    type: 'enum',
    enum: CaptureMethod,
  })
  captureMethod: CaptureMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ name: 'receipt_url', type: 'text', nullable: true })
  receiptUrl: string | null;

  @Column({ name: 'redirect_url', type: 'text', nullable: true })
  redirectUrl: string | null;

  @Column({ name: 'webhook_url', type: 'text', nullable: true })
  webhookUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;
}
