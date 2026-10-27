import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewDataEdicao1793045285601 implements MigrationInterface {
  name = 'AddReviewDataEdicao1793045285601';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: bancos de dev com synchronize já podem ter criado a coluna pela entity.
    await queryRunner.query(`
      ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "data_edicao" timestamp;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "review" DROP COLUMN IF EXISTS "data_edicao";
    `);
  }
}
