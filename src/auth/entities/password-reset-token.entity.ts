import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Person } from '../../people/entities/person.entity';

/**
 * Token de recuperação de senha (issue #250).
 *
 * Só o hash SHA-256 do token é guardado: quem lê o banco não consegue usar o
 * link. Uso único (`usadoEm`) e validade curta (`expiraEm`).
 */
@Entity()
export class PasswordResetToken {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_password_reset_token' })
  id: number;

  @Index('IDX_password_reset_token_cpf')
  @Column({ type: 'varchar', length: 11 })
  cpf: string;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'cpf',
    referencedColumnName: 'cpf',
    foreignKeyConstraintName: 'FK_password_reset_token_person',
  })
  person: Person;

  @Index('IDX_password_reset_token_hash', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiraEm: Date;

  @Column({ type: 'timestamp', nullable: true })
  usadoEm: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  criadoEm: Date;
}
