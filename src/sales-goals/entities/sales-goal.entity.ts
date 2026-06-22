import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Check,
  Unique,
} from 'typeorm';

import { Employee } from '../../employees/entities/employee.entity';

/**
 * Entidade SalesGoal (Meta de Vendas)
 *
 * Mapeia a tabela `sales_goal` no banco de dados.
 * Representa a meta de vendas individual ou coletiva para um determinado mês e ano.
 */
@Entity()
@Check(`"mes" BETWEEN 1 AND 12`)
@Check(`"valor_meta" >= 0`)
@Check(`"valor_bonus" IS NULL OR "valor_bonus" >= 0`)
@Unique(['cpfFuncionario', 'mes', 'ano'])
export class SalesGoal {
  @PrimaryGeneratedColumn({ name: 'id_goal' })
  idGoal: number;

  @Column({ name: 'cpf_funcionario', type: 'varchar', length: 11, nullable: true })
  cpfFuncionario: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cpf_funcionario', referencedColumnName: 'cpf' })
  employee: Employee | null;

  @Column({ type: 'integer' })
  mes: number;

  @Column({ type: 'integer' })
  ano: number;

  @Column({ name: 'valor_meta', type: 'decimal', precision: 12, scale: 2 })
  valorMeta: number;

  @Column({ name: 'valor_bonus', type: 'decimal', precision: 5, scale: 4, nullable: true })
  valorBonus: number | null;
}
