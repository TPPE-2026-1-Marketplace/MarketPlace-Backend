import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignOrdersAndGoalSchema1789331861553 implements MigrationInterface {
  name = 'AlignOrdersAndGoalSchema1789331861553';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "cliente_nome_avulso" varchar(150),
        ADD COLUMN IF NOT EXISTS "cliente_cpf_avulso" varchar(11),
        ADD COLUMN IF NOT EXISTS "cliente_email_avulso" varchar(255),
        ADD COLUMN IF NOT EXISTS "cliente_telefone" varchar(20),
        ADD COLUMN IF NOT EXISTS "endereco_cep" varchar(9),
        ADD COLUMN IF NOT EXISTS "endereco_rua" varchar(255),
        ADD COLUMN IF NOT EXISTS "endereco_numero" varchar(20),
        ADD COLUMN IF NOT EXISTS "endereco_complemento" varchar(100),
        ADD COLUMN IF NOT EXISTS "endereco_bairro" varchar(100),
        ADD COLUMN IF NOT EXISTS "endereco_cidade" varchar(100),
        ADD COLUMN IF NOT EXISTS "endereco_estado" varchar(2);
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sales_goal' AND column_name = 'taxa_comissao_bonus'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sales_goal' AND column_name = 'valor_bonus'
        ) THEN
          ALTER TABLE "sales_goal" RENAME COLUMN "taxa_comissao_bonus" TO "valor_bonus";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sales_goal' AND column_name = 'valor_bonus'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sales_goal' AND column_name = 'taxa_comissao_bonus'
        ) THEN
          ALTER TABLE "sales_goal" RENAME COLUMN "valor_bonus" TO "taxa_comissao_bonus";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "cliente_nome_avulso",
        DROP COLUMN IF EXISTS "cliente_cpf_avulso",
        DROP COLUMN IF EXISTS "cliente_email_avulso",
        DROP COLUMN IF EXISTS "cliente_telefone",
        DROP COLUMN IF EXISTS "endereco_cep",
        DROP COLUMN IF EXISTS "endereco_rua",
        DROP COLUMN IF EXISTS "endereco_numero",
        DROP COLUMN IF EXISTS "endereco_complemento",
        DROP COLUMN IF EXISTS "endereco_bairro",
        DROP COLUMN IF EXISTS "endereco_cidade",
        DROP COLUMN IF EXISTS "endereco_estado";
    `);
  }
}
