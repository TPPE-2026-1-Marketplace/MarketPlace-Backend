import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  idProduto: number;

  @Column({ type: 'varchar', length: 180 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ type: 'boolean', default: false })
  destaque: boolean;

  @Column({ type: 'varchar', length: 80, nullable: true })
  qualMedida: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  material: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  composicao: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  silhueta: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  precoBase: number;

  @Column({ type: 'varchar', length: 80 })
  SKU: string;
}
