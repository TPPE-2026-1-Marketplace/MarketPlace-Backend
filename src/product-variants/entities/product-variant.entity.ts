import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { CatalogImage } from '../../images/entities/catalog-image.entity';

@Entity()
export class ProductVariant {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  sku: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @OneToMany(() => CatalogImage, (catalogImage) => catalogImage.variant)
  catalogImages: CatalogImage[];
}
