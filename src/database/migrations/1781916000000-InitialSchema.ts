import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1781916000000 implements MigrationInterface {
  name = 'InitialSchema1781916000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "employee_role_perfil_enum" AS ENUM ('cliente', 'caixa', 'vendedor', 'gerente', 'administrador');
      CREATE TYPE "stock_log_tipo_movimentacao_enum" AS ENUM ('entrada', 'saida', 'ajuste', 'venda');
      CREATE TYPE "orders_status_enum" AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled');
      CREATE TYPE "orders_tipo_retirada_enum" AS ENUM ('entrega', 'loja');
      CREATE TYPE "payment_capture_method_enum" AS ENUM ('pix', 'credit_card', 'debit_card');
      CREATE TYPE "payment_status_enum" AS ENUM ('pending', 'paid', 'failed', 'refunded');

      CREATE TABLE "person" (
        "cpf" varchar(11) NOT NULL,
        "nome" varchar(120),
        "email" varchar(160) NOT NULL,
        "telefone" varchar(20),
        "senha" varchar(120),
        CONSTRAINT "pk_person" PRIMARY KEY ("cpf"),
        CONSTRAINT "uq_person_email" UNIQUE ("email")
      );

      CREATE TABLE "employee" (
        "cpf" varchar(11) NOT NULL,
        "ativo" boolean NOT NULL DEFAULT true,
        "role_perfil" "employee_role_perfil_enum" NOT NULL,
        "taxa_comissao" numeric(5,4) NOT NULL DEFAULT 0.025,
        "meta_vendas" numeric(12,2),
        "codigo_funcionario" varchar(20),
        CONSTRAINT "pk_employee" PRIMARY KEY ("cpf"),
        CONSTRAINT "uq_employee_codigo_funcionario" UNIQUE ("codigo_funcionario"),
        CONSTRAINT "fk_employee_person" FOREIGN KEY ("cpf") REFERENCES "person"("cpf") ON DELETE CASCADE
      );

      CREATE TABLE "address" (
        "id" SERIAL NOT NULL,
        "cpf_pessoa" varchar(11) NOT NULL,
        "cep" varchar(9) NOT NULL,
        "logradouro" varchar NOT NULL,
        "numero" varchar NOT NULL,
        "complemento" varchar,
        "bairro" varchar NOT NULL,
        "cidade" varchar NOT NULL,
        "uf" varchar(2) NOT NULL,
        CONSTRAINT "pk_address" PRIMARY KEY ("id"),
        CONSTRAINT "fk_address_person" FOREIGN KEY ("cpf_pessoa") REFERENCES "person"("cpf") ON DELETE CASCADE
      );

      CREATE TABLE "category" (
        "id_categoria" SERIAL NOT NULL,
        "nome" varchar(80) NOT NULL,
        CONSTRAINT "pk_category" PRIMARY KEY ("id_categoria")
      );

      CREATE TABLE "product" (
        "id_produto" SERIAL NOT NULL,
        "titulo" varchar(180) NOT NULL,
        "descricao" text,
        "destaque" boolean NOT NULL DEFAULT false,
        "qual_medida" varchar(80),
        "material" varchar(120),
        "composicao" varchar(180),
        "silhueta" varchar(120),
        "tags" text,
        "preco_base" numeric(10,2) NOT NULL,
        "sku" varchar(80) NOT NULL,
        "media_avaliacao" numeric(3,2) NOT NULL DEFAULT 0,
        "total_avaliacoes" integer NOT NULL DEFAULT 0,
        CONSTRAINT "pk_product" PRIMARY KEY ("id_produto"),
        CONSTRAINT "uq_product_sku" UNIQUE ("sku")
      );

      CREATE TABLE "product_category" (
        "product_id" integer NOT NULL,
        "category_id" integer NOT NULL,
        CONSTRAINT "pk_product_category" PRIMARY KEY ("product_id", "category_id"),
        CONSTRAINT "fk_product_category_product" FOREIGN KEY ("product_id") REFERENCES "product"("id_produto") ON DELETE CASCADE,
        CONSTRAINT "fk_product_category_category" FOREIGN KEY ("category_id") REFERENCES "category"("id_categoria") ON DELETE NO ACTION
      );
      CREATE INDEX "idx_product_category_product" ON "product_category" ("product_id");
      CREATE INDEX "idx_product_category_category" ON "product_category" ("category_id");

      CREATE TABLE "coupon" (
        "numero_do_cupom" varchar(50) NOT NULL,
        "tipo_cupom" varchar(30) NOT NULL,
        "valor_desconto" numeric(10,2) NOT NULL,
        "ativo" boolean NOT NULL DEFAULT true,
        "data_inicio" timestamp NOT NULL,
        "data_fim" timestamp NOT NULL,
        "uso_maximo" integer,
        "nome_influenciador" varchar(100),
        "usos_atuais" integer NOT NULL DEFAULT 0,
        CONSTRAINT "pk_coupon" PRIMARY KEY ("numero_do_cupom"),
        CONSTRAINT "chk_coupon_tipo" CHECK ("tipo_cupom" IN ('fixo', 'porcentagem')),
        CONSTRAINT "chk_coupon_periodo" CHECK ("data_fim" > "data_inicio"),
        CONSTRAINT "chk_coupon_valor" CHECK ("valor_desconto" > 0),
        CONSTRAINT "chk_coupon_uso_maximo" CHECK ("uso_maximo" IS NULL OR "uso_maximo" > 0),
        CONSTRAINT "chk_coupon_usos_atuais" CHECK ("usos_atuais" >= 0)
      );

      CREATE TABLE "coupon_product" (
        "coupon_id" varchar(50) NOT NULL,
        "product_id" integer NOT NULL,
        CONSTRAINT "pk_coupon_product" PRIMARY KEY ("coupon_id", "product_id"),
        CONSTRAINT "fk_coupon_product_coupon" FOREIGN KEY ("coupon_id") REFERENCES "coupon"("numero_do_cupom") ON DELETE CASCADE,
        CONSTRAINT "fk_coupon_product_product" FOREIGN KEY ("product_id") REFERENCES "product"("id_produto") ON DELETE NO ACTION
      );
      CREATE INDEX "idx_coupon_product_coupon" ON "coupon_product" ("coupon_id");
      CREATE INDEX "idx_coupon_product_product" ON "coupon_product" ("product_id");

      CREATE TABLE "product_variant" (
        "codigo_sku" varchar(80) NOT NULL,
        "preco_variante" numeric(12,2) NOT NULL,
        "ativo" boolean NOT NULL DEFAULT true,
        "cor" varchar(80),
        "tamanho" varchar(40),
        "medidas" jsonb DEFAULT NULL,
        "id_produto" integer NOT NULL,
        CONSTRAINT "pk_product_variant" PRIMARY KEY ("codigo_sku"),
        CONSTRAINT "fk_product_variant_product" FOREIGN KEY ("id_produto") REFERENCES "product"("id_produto") ON DELETE CASCADE
      );

      CREATE TABLE "image" (
        "id_imagem" SERIAL NOT NULL,
        "url" text NOT NULL,
        "ordem" integer NOT NULL DEFAULT 0,
        "descricao" varchar(255),
        "local_renderizacao" varchar(120),
        CONSTRAINT "pk_image" PRIMARY KEY ("id_imagem")
      );

      CREATE TABLE "catalog_image" (
        "id_imagem" integer NOT NULL,
        "codigo_sku" varchar(40) NOT NULL,
        "ordem_no_catalogo" integer NOT NULL DEFAULT 0,
        CONSTRAINT "pk_catalog_image" PRIMARY KEY ("id_imagem", "codigo_sku"),
        CONSTRAINT "fk_catalog_image_image" FOREIGN KEY ("id_imagem") REFERENCES "image"("id_imagem") ON DELETE CASCADE,
        CONSTRAINT "fk_catalog_image_variant" FOREIGN KEY ("codigo_sku") REFERENCES "product_variant"("codigo_sku") ON DELETE CASCADE
      );

      CREATE TABLE "stock" (
        "codigo_sku" varchar(40) NOT NULL,
        "qtd_online" integer NOT NULL DEFAULT 0,
        "qtd_loja_fisica" integer NOT NULL DEFAULT 0,
        CONSTRAINT "pk_stock" PRIMARY KEY ("codigo_sku"),
        CONSTRAINT "chk_stock_online" CHECK ("qtd_online" >= 0),
        CONSTRAINT "chk_stock_loja" CHECK ("qtd_loja_fisica" >= 0),
        CONSTRAINT "fk_stock_variant" FOREIGN KEY ("codigo_sku") REFERENCES "product_variant"("codigo_sku") ON DELETE CASCADE
      );

      CREATE TABLE "stock_log" (
        "id_log" SERIAL NOT NULL,
        "codigo_sku" varchar(40) NOT NULL,
        "id_pedido" integer,
        "tipo_movimentacao" "stock_log_tipo_movimentacao_enum" NOT NULL,
        "quantidade_movimentada" integer NOT NULL,
        "data_criacao" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "valor_anterior_online" integer,
        "valor_novo_online" integer,
        "valor_anterior_loja" integer,
        "valor_novo_loja" integer,
        "origem" varchar(80),
        "motivo" varchar(200),
        CONSTRAINT "pk_stock_log" PRIMARY KEY ("id_log"),
        CONSTRAINT "fk_stock_log_variant" FOREIGN KEY ("codigo_sku") REFERENCES "product_variant"("codigo_sku") ON DELETE CASCADE
      );

      CREATE TABLE "orders" (
        "id_pedido" SERIAL NOT NULL,
        "id_usuario" varchar(11),
        "id_cupom" varchar(50),
        "data_pedido" timestamp NOT NULL DEFAULT now(),
        "status" "orders_status_enum" NOT NULL DEFAULT 'pending',
        "subtotal" numeric(12,2) NOT NULL,
        "valor_frete" numeric(12,2) NOT NULL,
        "valor_total" numeric(12,2) NOT NULL,
        "tipo_retirada" "orders_tipo_retirada_enum" NOT NULL,
        "codigo_verificacao_retirada" varchar(50),
        "id_funcionario" varchar(11),
        "codigo_rastreamento" varchar(100),
        CONSTRAINT "pk_orders" PRIMARY KEY ("id_pedido"),
        CONSTRAINT "chk_orders_subtotal" CHECK ("subtotal" >= 0),
        CONSTRAINT "chk_orders_frete" CHECK ("valor_frete" >= 0),
        CONSTRAINT "chk_orders_total" CHECK ("valor_total" >= 0),
        CONSTRAINT "fk_orders_user" FOREIGN KEY ("id_usuario") REFERENCES "person"("cpf") ON DELETE RESTRICT,
        CONSTRAINT "fk_orders_coupon" FOREIGN KEY ("id_cupom") REFERENCES "coupon"("numero_do_cupom") ON DELETE SET NULL,
        CONSTRAINT "fk_orders_employee" FOREIGN KEY ("id_funcionario") REFERENCES "employee"("cpf") ON DELETE SET NULL
      );
      CREATE INDEX "idx_orders_user" ON "orders" ("id_usuario");
      CREATE INDEX "idx_orders_coupon" ON "orders" ("id_cupom");
      CREATE INDEX "idx_orders_pickup_code" ON "orders" ("codigo_verificacao_retirada");
      CREATE INDEX "idx_orders_employee" ON "orders" ("id_funcionario");
      CREATE INDEX "idx_orders_ranking" ON "orders" ("id_funcionario", "tipo_retirada", "status", "data_pedido");

      CREATE TABLE "order_item" (
        "id_item_pedido" SERIAL NOT NULL,
        "id_pedido" integer NOT NULL,
        "id_variante" varchar(80) NOT NULL,
        "quantidade" integer NOT NULL,
        "preco_unitario" numeric(12,2) NOT NULL,
        CONSTRAINT "pk_order_item" PRIMARY KEY ("id_item_pedido"),
        CONSTRAINT "chk_order_item_quantidade" CHECK ("quantidade" > 0),
        CONSTRAINT "chk_order_item_preco" CHECK ("preco_unitario" >= 0),
        CONSTRAINT "fk_order_item_order" FOREIGN KEY ("id_pedido") REFERENCES "orders"("id_pedido") ON DELETE CASCADE,
        CONSTRAINT "fk_order_item_variant" FOREIGN KEY ("id_variante") REFERENCES "product_variant"("codigo_sku") ON DELETE RESTRICT
      );

      CREATE TABLE "payment" (
        "id_pagamento" SERIAL NOT NULL,
        "id_pedido" integer NOT NULL,
        "order_nsu" varchar,
        "transaction_nsu" varchar,
        "invoice_slug" varchar,
        "amount" numeric(12,2) NOT NULL,
        "paid_amount" numeric(12,2),
        "installments" integer NOT NULL DEFAULT 1,
        "capture_method" "payment_capture_method_enum" NOT NULL,
        "status" "payment_status_enum" NOT NULL DEFAULT 'pending',
        "receipt_url" text,
        "redirect_url" text,
        "webhook_url" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "pk_payment" PRIMARY KEY ("id_pagamento"),
        CONSTRAINT "chk_payment_amount" CHECK ("amount" >= 0),
        CONSTRAINT "chk_payment_paid_amount" CHECK ("paid_amount" IS NULL OR "paid_amount" >= 0),
        CONSTRAINT "chk_payment_installments" CHECK ("installments" >= 1),
        CONSTRAINT "fk_payment_order" FOREIGN KEY ("id_pedido") REFERENCES "orders"("id_pedido") ON DELETE CASCADE
      );

      CREATE TABLE "review" (
        "cpf_cliente" varchar(11) NOT NULL,
        "id_produto" integer NOT NULL,
        "nota" integer NOT NULL,
        "comentario" varchar(2000),
        "data_avaliacao" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "pk_review" PRIMARY KEY ("cpf_cliente", "id_produto"),
        CONSTRAINT "chk_review_nota" CHECK (nota >= 1 AND nota <= 5),
        CONSTRAINT "fk_review_person" FOREIGN KEY ("cpf_cliente") REFERENCES "person"("cpf") ON DELETE CASCADE,
        CONSTRAINT "fk_review_product" FOREIGN KEY ("id_produto") REFERENCES "product"("id_produto") ON DELETE CASCADE
      );
      CREATE INDEX "idx_review_product_date" ON "review" ("id_produto", "data_avaliacao");

      CREATE TABLE "sales_goal" (
        "id_goal" SERIAL NOT NULL,
        "cpf_funcionario" varchar(11),
        "mes" integer NOT NULL,
        "ano" integer NOT NULL,
        "valor_meta" numeric(12,2) NOT NULL,
        "taxa_comissao_bonus" numeric(5,4),
        CONSTRAINT "pk_sales_goal" PRIMARY KEY ("id_goal"),
        CONSTRAINT "uq_sales_goal_period" UNIQUE ("cpf_funcionario", "mes", "ano"),
        CONSTRAINT "chk_sales_goal_mes" CHECK ("mes" BETWEEN 1 AND 12),
        CONSTRAINT "chk_sales_goal_valor" CHECK ("valor_meta" >= 0),
        CONSTRAINT "chk_sales_goal_bonus" CHECK ("taxa_comissao_bonus" IS NULL OR "taxa_comissao_bonus" >= 0),
        CONSTRAINT "fk_sales_goal_employee" FOREIGN KEY ("cpf_funcionario") REFERENCES "employee"("cpf") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "sales_goal";
      DROP TABLE "review";
      DROP TABLE "payment";
      DROP TABLE "order_item";
      DROP TABLE "orders";
      DROP TABLE "stock_log";
      DROP TABLE "stock";
      DROP TABLE "catalog_image";
      DROP TABLE "image";
      DROP TABLE "product_variant";
      DROP TABLE "coupon_product";
      DROP TABLE "coupon";
      DROP TABLE "product_category";
      DROP TABLE "product";
      DROP TABLE "category";
      DROP TABLE "address";
      DROP TABLE "employee";
      DROP TABLE "person";
      DROP TYPE "payment_status_enum";
      DROP TYPE "payment_capture_method_enum";
      DROP TYPE "orders_tipo_retirada_enum";
      DROP TYPE "orders_status_enum";
      DROP TYPE "stock_log_tipo_movimentacao_enum";
      DROP TYPE "employee_role_perfil_enum";
    `);
  }
}
