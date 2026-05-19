import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';
import { Image } from './image.entity';

@Entity()
export class CatalogImage {
  @PrimaryColumn()
  idImagem: number;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  codigoSku: string;

  @Column({ type: 'int', default: 0 })
  ordemNoCatalogo: number;

  @ManyToOne(() => Image, (image) => image.catalogImages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_imagem' })
  image: Image;

  @ManyToOne(() => ProductVariant, (variant) => variant.catalogImages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'codigo_sku' })
  variant: ProductVariant;
}
