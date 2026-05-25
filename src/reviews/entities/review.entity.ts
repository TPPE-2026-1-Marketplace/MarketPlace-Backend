import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { Person } from '../../people/entities/person.entity';
import { Product } from '../../products/entities/product.entity';

/**
 * Entidade Review (Avaliação de Produto).
 *
 * Mapeia a tabela `review` no banco de dados (SnakeNamingStrategy resolve para `review`).
 *
 * PK Composta: (id_cliente, id_produto)
 * FK para Person: id_cliente -> person.cpf
 * FK para Product: id_produto -> product.id_produto
 * Constraint: nota >= 1 AND nota <= 5
 */
@Entity()
@Check('nota >= 1 AND nota <= 5')
@Index(['idProduto', 'dataAvaliacao'])
export class Review {
  @PrimaryColumn({ type: 'varchar', length: 11 })
  cpfCliente: string;

  @PrimaryColumn({ type: 'int' })
  idProduto: number;

  @Column({ type: 'int' })
  nota: number;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  comentario: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  dataAvaliacao: Date;

  @ManyToOne(() => Person, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cpf_cliente' })
  cliente: Person;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_produto' })
  produto: Product;
}
