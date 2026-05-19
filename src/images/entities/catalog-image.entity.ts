import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';
import { Image } from './image.entity';

@Entity()
export class CatalogImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', default: 0 })
  ordemNoCatalogo: number;

  @ManyToOne(() => Image, (image) => image.catalogImages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  image: Image;

  @ManyToOne(() => ProductVariant, (variant) => variant.catalogImages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  variant: ProductVariant;
}
