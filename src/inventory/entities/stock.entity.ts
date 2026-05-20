import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';

@Entity()
@Check('"qtd_online" >= 0')
@Check('"qtd_loja_fisica" >= 0')
export class Stock {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  codigoSku: string;

  @Column({ type: 'int', default: 0 })
  qtdOnline: number;

  @Column({ type: 'int', default: 0 })
  qtdLojaFisica: number;

  @OneToOne(() => ProductVariant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'codigo_sku', referencedColumnName: 'codigoSku' })
  variant: ProductVariant;
}
