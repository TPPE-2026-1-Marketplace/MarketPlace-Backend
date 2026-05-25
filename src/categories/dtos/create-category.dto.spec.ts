import { CreateCategorySchema } from './create-category.dto';
import { QueryCategoriesSchema } from './query-categories.dto';
import { UpdateCategorySchema } from './update-category.dto';

describe('CreateCategorySchema', () => {
  it('rejeita quando nome está ausente', () => {
    expect(() => CreateCategorySchema.parse({})).toThrow();
  });

  it.each([
    ['nome comum', 'Camisetas', true],
    ['nome com 80 chars (limite)', 'a'.repeat(80), true],
    ['1 caractere', 'a', true],
    ['vazio', '', false],
    ['81 chars (acima do limite)', 'a'.repeat(81), false],
  ])('nome %s => válido=%s', (_descricao, nome, valid) => {
    const parse = () => CreateCategorySchema.parse({ nome });
    if (valid) {
      expect(parse).not.toThrow();
    } else {
      expect(parse).toThrow();
    }
  });
});

describe('UpdateCategorySchema', () => {
  it('aceita payload vazio (todos os campos são opcionais)', () => {
    expect(() => UpdateCategorySchema.parse({})).not.toThrow();
  });

  it('aceita nome válido', () => {
    expect(() => UpdateCategorySchema.parse({ nome: 'Vestidos' })).not.toThrow();
  });

  it('ainda rejeita nome vazio', () => {
    expect(() => UpdateCategorySchema.parse({ nome: '' })).toThrow();
  });

  it('ainda rejeita nome com mais de 80 caracteres', () => {
    expect(() => UpdateCategorySchema.parse({ nome: 'a'.repeat(81) })).toThrow();
  });
});

describe('QueryCategoriesSchema', () => {
  it('usa defaults quando sem parâmetros', () => {
    const result = QueryCategoriesSchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('converte strings para número (query params chegam como string)', () => {
    const result = QueryCategoriesSchema.parse({ page: '2', limit: '5' });
    expect(result).toEqual({ page: 2, limit: 5 });
  });

  it('rejeita page menor que 1', () => {
    expect(() => QueryCategoriesSchema.parse({ page: 0 })).toThrow();
  });

  it('rejeita limit maior que 100', () => {
    expect(() => QueryCategoriesSchema.parse({ limit: 101 })).toThrow();
  });

  it('aceita limit igual a 100', () => {
    expect(() => QueryCategoriesSchema.parse({ limit: 100 })).not.toThrow();
  });
});
