import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn({ name: 'id_produto' })
  id_produto: number;

  @Column()
  titulo: string;

  @Column('decimal', { precision: 10, scale: 2 })
  preco_base: number;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ type: 'varchar', nullable: true })
  categoria: string | null;

  @Column({ type: 'varchar', nullable: true })
  imagem_url: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
