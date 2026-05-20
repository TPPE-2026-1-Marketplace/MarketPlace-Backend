import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entity Person.
 *
 * Mapeia a tabela `person` no banco (gerada via SnakeNamingStrategy a partir
 * do nome da classe). É a entidade base de identidade do sistema, usada tanto
 * por clientes quanto, via especialização 1:1 (futuro módulo `employees`),
 * por funcionários.
 *
 * Decisões de modelagem (ver CONTEXT.md):
 * - PK: CPF (string de 11 dígitos sem formatação).
 * - `email` é único — usado para login.
 * - `senha` é nullable: clientes cadastrados pelo caixa (US11) entram sem
 *   senha e completam o cadastro depois (definindo a senha em fluxo separado).
 * - Endereço está em tabela separada (N:1 com Person) — apenas pessoas
 *   que completam auto-cadastro têm endereço(s).
 * - Nomes de coluna em português (alinhamento com o domínio de negócio).
 */
@Entity()
export class Person {
  @PrimaryColumn({ type: 'varchar', length: 11 })
  cpf: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefone: string | null;

  /**
   * Hash bcrypt da senha. Nunca a senha em texto puro.
   * Pode ser nula em casos onde o cadastro foi feito pelo caixa (US11) e o
   * cliente ainda não definiu uma senha. Pessoas sem senha não conseguem
   * fazer login (verificação no AuthService, em D0).
   */
  @Column({ type: 'varchar', length: 120, nullable: true })
  senha: string | null;
}
