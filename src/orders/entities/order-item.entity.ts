import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Check } from 'typeorm';

import { Order } from './order.entity';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';

/**
 * Entidade OrderItem (Item do Pedido)
 *
 * Mapeia a tabela `order_items` no banco de dados.
 * Referencia os produtos específicos e suas quantidades em um determinado pedido.
 */
@Entity('order_item')
@Check(`"quantidade" > 0`)
@Check(`"preco_unitario" >= 0`)
export class OrderItem {
  @PrimaryGeneratedColumn({ name: 'id_item_pedido' })
  idItemPedido: number;

  @Column({ name: 'id_pedido', type: 'integer' })
  idPedido: number;

  @ManyToOne(() => Order, (order) => order.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido', referencedColumnName: 'idPedido' })
  order: Order;

  @Column({ name: 'id_variante', type: 'varchar', length: 80 })
  idVariante: string;

  @ManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_variante', referencedColumnName: 'codigoSku' })
  variant: ProductVariant;

  @Column({ type: 'integer' })
  quantidade: number;

  @Column({ name: 'preco_unitario', type: 'decimal', precision: 12, scale: 2 })
  precoUnitario: number;
}
