import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782002254922 implements MigrationInterface {
    name = 'InitialSchema1782002254922'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "order" ("id_pedido" SERIAL NOT NULL, "items" jsonb NOT NULL DEFAULT '[]', "subtotal" numeric(10,2) NOT NULL, "frete" numeric(10,2), "desconto" numeric(10,2), "total" numeric(10,2) NOT NULL, "payment_method" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pendente', "cliente_nome" character varying, "cliente_email" character varying, "cliente_cpf" character varying, "cliente_telefone" character varying, "endereco_cep" character varying, "endereco_rua" character varying, "endereco_numero" character varying, "endereco_complemento" character varying, "endereco_bairro" character varying, "endereco_cidade" character varying, "endereco_estado" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cf61027860ae4c412597aeef122" PRIMARY KEY ("id_pedido"))`);
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "cpf" character varying, "telefone" character varying, "role" character varying NOT NULL DEFAULT 'customer', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_a6235b5ef0939d8deaad755fc87" UNIQUE ("cpf"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "product" ("id_produto" SERIAL NOT NULL, "titulo" character varying NOT NULL, "preco_base" numeric(10,2) NOT NULL, "preco_original" numeric(10,2), "descricao" text, "categoria" character varying, "imagem_url" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4a4698bc9726f79d35817636a98" PRIMARY KEY ("id_produto"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "product"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "order"`);
    }

}
