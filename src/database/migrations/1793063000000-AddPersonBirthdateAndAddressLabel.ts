import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonBirthdateAndAddressLabel1793063000000 implements MigrationInterface {
  name = 'AddPersonBirthdateAndAddressLabel1793063000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "person" ADD COLUMN "data_nascimento" date;
      ALTER TABLE "address" ADD COLUMN "nome" varchar(60);
      ALTER TABLE "address" ADD COLUMN "principal" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "address" DROP COLUMN "principal";
      ALTER TABLE "address" DROP COLUMN "nome";
      ALTER TABLE "person" DROP COLUMN "data_nascimento";
    `);
  }
}
