import { MeasurementsSchema, CreateProductVariantSchema } from './create-product-variant.dto';

describe('MeasurementsSchema', () => {
  it('aceita objeto vazio', () => {
    expect(() => MeasurementsSchema.parse({})).not.toThrow();
  });

  it('aceita campos conhecidos', () => {
    const result = MeasurementsSchema.parse({ busto: 90, cintura: 70, quadril: 95 });
    expect(result).toEqual({ busto: 90, cintura: 70, quadril: 95 });
  });

  it('aceita todos os campos do domínio', () => {
    const input = { busto: 90, cintura: 70, quadril: 95, comprimento: 120, manga: 60, pulso: 18 };
    expect(() => MeasurementsSchema.parse(input)).not.toThrow();
  });

  it('aceita campos extras (estrutura aberta)', () => {
    const result = MeasurementsSchema.parse({ busto: 90, ombro: 42, entrepernas: 80 });
    expect(result).toMatchObject({ busto: 90, ombro: 42, entrepernas: 80 });
  });

  it('rejeita valores não numéricos', () => {
    expect(() => MeasurementsSchema.parse({ busto: 'noventa' })).toThrow();
  });
});

describe('CreateProductVariantSchema — campo medidas', () => {
  const base = { idProduto: 1, codigo_sku: 'SKU-001', preco_variante: 99.9 };

  it('aceita variante sem medidas', () => {
    expect(() => CreateProductVariantSchema.parse(base)).not.toThrow();
  });

  it('aceita variante com medidas parciais', () => {
    expect(() =>
      CreateProductVariantSchema.parse({ ...base, medidas: { busto: 90, cintura: 70 } }),
    ).not.toThrow();
  });

  it('aceita variante com objeto medidas vazio', () => {
    expect(() =>
      CreateProductVariantSchema.parse({ ...base, medidas: {} }),
    ).not.toThrow();
  });

  it('aceita medidas com campos extras', () => {
    expect(() =>
      CreateProductVariantSchema.parse({ ...base, medidas: { busto: 90, ombro: 42 } }),
    ).not.toThrow();
  });
});
