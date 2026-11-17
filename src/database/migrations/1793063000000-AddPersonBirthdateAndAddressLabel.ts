import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonBirthdateAndAddressLabel1793063000000 implements MigrationInterface {
  name = 'AddPersonBirthdateAndAddressLabel1793063000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: o banco de produção já tinha estas colunas (criadas por um
    // ambiente com synchronize apontado para ele), e o migration:run falhava com
    // "column already exists" (42701), derrubando o deploy.
    await queryRunner.query(`
      ALTER TABLE "person" ADD COLUMN IF NOT EXISTS "data_nascimento" date;
      ALTER TABLE "address" ADD COLUMN IF NOT EXISTS "nome" varchar(60);
      ALTER TABLE "address" ADD COLUMN IF NOT EXISTS "principal" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "address" DROP COLUMN IF EXISTS "principal";
      ALTER TABLE "address" DROP COLUMN IF EXISTS "nome";
      ALTER TABLE "person" DROP COLUMN IF EXISTS "data_nascimento";
    `);
  }
}
