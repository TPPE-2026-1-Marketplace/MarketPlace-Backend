import { Check, Column, Entity, JoinTable, ManyToMany, PrimaryColumn } from 'typeorm';

import { Product } from '../../products/entities/product.entity';

/**
 * Entidade Coupon (Cupom de Desconto)
 *
 * Mapeia a tabela `coupon` no banco.
 * Decisões de modelagem (conforme diagrama US13/US14):
 * - PK: `numero_do_cupom` (TS: `numeroDoCupom`).
 * - `tipo_cupom` (TS: `tipoCupom`): e.g. 'fixo' ou 'porcentagem'.
 * - `valor_desconto` (TS: `valorDesconto`): valor decimal.
 * - `ativo`: cupom habilitado ou desabilitado (padrão true).
 * - `data_inicio` (TS: `dataInicio`): início da vigência do cupom.
 * - `data_fim` (TS: `dataFim`): término da vigência do cupom.
 * - `uso_maximo` (TS: `usoMaximo`): número limite de utilizações, opcional (nullable).
 * - `nome_influenciador` (TS: `nomeInfluenciador`): nome do influenciador/parceiro da campanha, opcional (nullable).
 * - `usos_atuais` (TS: `usosAtuais`): quantidade de vezes que o cupom já foi utilizado no sistema (padrão 0).
 * - `products` (N:N com Product): lista de produtos específicos elegíveis para o cupom.
 */
@Entity()
@Check(`"tipo_cupom" IN ('fixo', 'porcentagem')`)
@Check(`"data_fim" > "data_inicio"`)
@Check(`"valor_desconto" > 0`)
@Check(`"uso_maximo" IS NULL OR "uso_maximo" > 0`)
@Check(`"usos_atuais" >= 0`)
export class Coupon {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  numeroDoCupom: string;

  @Column({ type: 'varchar', length: 30 })
  tipoCupom: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valorDesconto: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'timestamp' })
  dataInicio: Date;

  @Column({ type: 'timestamp' })
  dataFim: Date;

  @Column({ type: 'integer', nullable: true })
  usoMaximo: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nomeInfluenciador: string | null;

  @Column({ type: 'integer', default: 0 })
  usosAtuais: number;

  @ManyToMany(() => Product, (product) => product.coupons, {
    cascade: false,
    onDelete: 'CASCADE',
  })
  @JoinTable({
    name: 'coupon_product',
    joinColumn: {
      name: 'coupon_id',
      referencedColumnName: 'numeroDoCupom',
    },
    inverseJoinColumn: {
      name: 'product_id',
      referencedColumnName: 'idProduto',
    },
  })
  products: Product[];
}
