import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  idCategoria: number;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @ManyToMany(() => Product, (product) => product.categories)
  products: Product[];
}
