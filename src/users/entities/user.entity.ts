import { Logger } from '@nestjs/common';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  BeforeInsert,
  AfterInsert,
} from 'typeorm';

@Entity()
export class User {
  private static readonly logger = new Logger(User.name);

  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
  @Column({ unique: true })
  email: string;
  @Column()
  password: string;
  @Column({ unique: true, nullable: true })
  cpf: string | null;
  @Column({ nullable: true })
  telefone: string | null;
  @Column({ default: 'customer' })
  role: string;
  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  logBeforeInsert(): void {
    User.logger.log(`Lifecycle BeforeInsert para o email=${this.email} e cpf=${this.cpf}`);
  }

  @AfterInsert()
  logAfterInsert(): void {
    User.logger.log(`Lifecycle AfterInsert concluido com id=${this.id}`);
  }
}
