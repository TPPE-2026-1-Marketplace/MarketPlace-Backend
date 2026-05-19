import { CreateCategorySchema } from './create-category.dto';
import { UpdateCategorySchema } from './update-category.dto';
import { QueryCategoriesSchema } from './query-categories.dto';

describe('CreateCategorySchema', () => {
  it('aceita nome válido', () => {
    expect(() => CreateCategorySchema.parse({ nome: 'Camisetas' })).not.toThrow();
  });

  it('rejeita nome vazio', () => {
    expect(() => CreateCategorySchema.parse({ nome: '' })).toThrow();
  });

  it('rejeita quando nome está ausente', () => {
    expect(() => CreateCategorySchema.parse({})).toThrow();
  });

  it('rejeita nome com mais de 80 caracteres', () => {
    expect(() => CreateCategorySchema.parse({ nome: 'a'.repeat(81) })).toThrow();
  });

  it('aceita nome com exatamente 80 caracteres', () => {
    expect(() => CreateCategorySchema.parse({ nome: 'a'.repeat(80) })).not.toThrow();
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
