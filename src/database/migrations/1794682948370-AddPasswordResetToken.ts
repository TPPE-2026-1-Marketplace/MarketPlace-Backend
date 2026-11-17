import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Tokens de recuperação de senha (issue #250). Só o hash SHA-256 do token é gravado. */
export class AddPasswordResetToken1794682948370 implements MigrationInterface {
  name = 'AddPasswordResetToken1794682948370';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: bancos de dev com synchronize já podem ter criado a tabela pela entity.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_token" (
        "id" SERIAL NOT NULL,
        "cpf" varchar(11) NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expira_em" timestamp NOT NULL,
        "usado_em" timestamp,
        "criado_em" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_token" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_reset_token_person" FOREIGN KEY ("cpf")
          REFERENCES "person"("cpf") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_password_reset_token_hash"
        ON "password_reset_token" ("token_hash");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_password_reset_token_cpf"
        ON "password_reset_token" ("cpf");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_token";`);
  }
}
