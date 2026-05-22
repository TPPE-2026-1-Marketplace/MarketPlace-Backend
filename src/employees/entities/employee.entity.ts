import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { Role } from '../../common/enums/role.enum';
import { Person } from '../../people/entities/person.entity';

@Entity()
export class Employee {
  @PrimaryColumn({ type: 'varchar', length: 11 })
  cpf: string;

  @OneToOne(() => Person, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'cpf', referencedColumnName: 'cpf' })
  person: Person;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'enum', enum: Role })
  role_perfil: Role;

  @Column({ type: 'numeric', precision: 5, scale: 4, default: 0.025 })
  taxa_comissao: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  meta_vendas: number | null;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  codigo_funcionario: string | null;
}
