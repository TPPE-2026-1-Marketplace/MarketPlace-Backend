import { Column, Entity, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { CatalogImage } from '../../images/entities/catalog-image.entity';
import { Product } from '../../products/entities/product.entity';

@Entity()
export class ProductVariant {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  sku: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @OneToMany(() => CatalogImage, (catalogImage) => catalogImage.variant)
  catalogImages: CatalogImage[];

  @ManyToOne(() => Product, (product) => product.variants, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  product: Product | null;
}
