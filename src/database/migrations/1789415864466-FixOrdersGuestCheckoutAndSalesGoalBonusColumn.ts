import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fecha o drift entre entities e migrations identificado na issue #157.
 *
 * `synchronize: true` em dev aplicou essas mudanças automaticamente no schema
 * há tempos, mas nenhuma migration foi gerada — produção (que só roda
 * migrations) nunca recebeu essas colunas.
 *
 * 1. `orders`: 11 colunas do fluxo de "cliente avulso" (venda presencial sem
 *    cadastro) + snapshot de endereço, adicionadas à entity em 2026-06-22
 *    (commit 6d24e74, "fix: cashier login") — um dia depois da InitialSchema.
 * 2. `sales_goal.taxa_comissao_bonus` renomeada para `valor_bonus` na entity,
 *    sem migration correspondente.
 */
export class FixOrdersGuestCheckoutAndSalesGoalBonusColumn1789415864466 implements MigrationInterface {
  name = 'FixOrdersGuestCheckoutAndSalesGoalBonusColumn1789415864466';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD "cliente_nome_avulso" varchar(150),
        ADD "cliente_cpf_avulso" varchar(11),
        ADD "cliente_email_avulso" varchar(255),
        ADD "cliente_telefone" varchar(20),
        ADD "endereco_cep" varchar(9),
        ADD "endereco_rua" varchar(255),
        ADD "endereco_numero" varchar(20),
        ADD "endereco_complemento" varchar(100),
        ADD "endereco_bairro" varchar(100),
        ADD "endereco_cidade" varchar(100),
        ADD "endereco_estado" varchar(2);

      ALTER TABLE "sales_goal"
        RENAME COLUMN "taxa_comissao_bonus" TO "valor_bonus";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_goal"
        RENAME COLUMN "valor_bonus" TO "taxa_comissao_bonus";

      ALTER TABLE "orders"
        DROP COLUMN "cliente_nome_avulso",
        DROP COLUMN "cliente_cpf_avulso",
        DROP COLUMN "cliente_email_avulso",
        DROP COLUMN "cliente_telefone",
        DROP COLUMN "endereco_cep",
        DROP COLUMN "endereco_rua",
        DROP COLUMN "endereco_numero",
        DROP COLUMN "endereco_complemento",
        DROP COLUMN "endereco_bairro",
        DROP COLUMN "endereco_cidade",
        DROP COLUMN "endereco_estado";
    `);
  }
}
