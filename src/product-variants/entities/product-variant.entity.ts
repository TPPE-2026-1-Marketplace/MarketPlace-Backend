import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { CatalogImage } from '../../images/entities/catalog-image.entity';
import { Product } from '../../products/entities/product.entity';
import { Measurements } from '../interfaces/measurements.interface';

@Entity()
export class ProductVariant {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  codigoSku: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  precoVariante: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'varchar', length: 80, nullable: true })
  cor: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  tamanho: string | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  medidas: Measurements | null;

  @OneToMany(() => CatalogImage, (catalogImage) => catalogImage.variant)
  catalogImages: CatalogImage[];

  @ManyToOne(() => Product, (product) => product.variants, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_produto', referencedColumnName: 'idProduto' })
  product: Product;
}
