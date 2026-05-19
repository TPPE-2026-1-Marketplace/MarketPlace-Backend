import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

const mockCategory: Category = {
  idCategoria: 1,
  nome: 'Camisetas',
  products: [],
};

const mockProduct: Product = {
  idProduto: 1,
  titulo: 'Camiseta Branca',
  descricao: null,
  destaque: false,
  qualMedida: null,
  material: null,
  composicao: null,
  silhueta: null,
  tags: null,
  precoBase: 99.9,
  sku: 'CAM-001',
  categories: [],
  variants: [],
};

const makeQueryBuilder = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[mockProduct], 1]),
  ...overrides,
});

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepo: jest.Mocked<Repository<Product>>;
  let categoriesRepo: jest.Mocked<Repository<Category>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ProductsService);
    productsRepo = module.get(getRepositoryToken(Product));
    categoriesRepo = module.get(getRepositoryToken(Category));
  });

  describe('create', () => {
    it('cria e retorna o produto', async () => {
      productsRepo.create.mockReturnValue(mockProduct);
      productsRepo.save.mockResolvedValue(mockProduct);

      const result = await service.create({
        titulo: 'Camiseta Branca',
        preco_base: 99.9,
        sku: 'CAM-001',
      });

      expect(result).toEqual(mockProduct);
      expect(productsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: 'Camiseta Branca', sku: 'CAM-001' }),
      );
    });

    it('aplica defaults para campos opcionais omitidos', async () => {
      productsRepo.create.mockReturnValue(mockProduct);
      productsRepo.save.mockResolvedValue(mockProduct);

      await service.create({ titulo: 'Produto', preco_base: 50, sku: 'P-001' });

      expect(productsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          descricao: null,
          destaque: false,
          qualMedida: null,
          material: null,
          composicao: null,
          silhueta: null,
          tags: null,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('retorna lista paginada com meta correto', async () => {
      const qb = makeQueryBuilder();
      productsRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockProduct]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('calcula totalPages corretamente', async () => {
      const qb = makeQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 25]),
      });
      productsRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('retorna totalPages 1 quando não há registros', async () => {
      const qb = makeQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      productsRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(1);
    });

    it('aplica innerJoin quando categoryId é fornecido', async () => {
      const qb = makeQueryBuilder();
      productsRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAll({ page: 1, limit: 20, categoryId: 5 });

      expect(qb.innerJoin).toHaveBeenCalled();
    });

    it('aplica andWhere para destaque quando fornecido', async () => {
      const qb = makeQueryBuilder();
      productsRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAll({ page: 1, limit: 20, destaque: true });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('destaque'),
        expect.any(Object),
      );
    });

    it('aplica andWhere para precoMin e precoMax quando fornecidos', async () => {
      const qb = makeQueryBuilder();
      productsRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAll({ page: 1, limit: 20, precoMin: 50, precoMax: 200 });

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('findOne', () => {
    it('retorna o produto com categories e variants', async () => {
      productsRepo.findOne.mockResolvedValue(mockProduct);

      const result = await service.findOne(1);

      expect(result).toEqual(mockProduct);
      expect(productsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { categories: true, variants: true } }),
      );
    });

    it('lança NotFoundException quando id não existe', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('atualiza e retorna o produto', async () => {
      const updated = { ...mockProduct, titulo: 'Camiseta Preta' };
      productsRepo.findOne
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(updated);
      productsRepo.save.mockResolvedValue(updated);

      const result = await service.update(1, { titulo: 'Camiseta Preta' });

      expect(result.titulo).toBe('Camiseta Preta');
    });

    it('lança NotFoundException quando id não existe', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { titulo: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove sem erros quando id existe', async () => {
      productsRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await expect(service.remove(1)).resolves.toBeUndefined();
    });

    it('lança NotFoundException quando id não existe', async () => {
      productsRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addCategory', () => {
    it('adiciona categoria ao produto', async () => {
      const productWithCategories = { ...mockProduct, categories: [] };
      const productAfter = { ...mockProduct, categories: [mockCategory] };
      productsRepo.findOne
        .mockResolvedValueOnce(productWithCategories)
        .mockResolvedValueOnce(productAfter);
      categoriesRepo.findOne.mockResolvedValue(mockCategory);
      productsRepo.save.mockResolvedValue(productAfter);

      const result = await service.addCategory(1, 1);

      expect(result.categories).toContain(mockCategory);
    });

    it('não duplica categoria já vinculada', async () => {
      const productWithCategory = { ...mockProduct, categories: [mockCategory] };
      productsRepo.findOne.mockResolvedValue(productWithCategory);
      categoriesRepo.findOne.mockResolvedValue(mockCategory);

      await service.addCategory(1, 1);

      expect(productsRepo.save).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando produto não existe', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.addCategory(999, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança NotFoundException quando categoria não existe', async () => {
      productsRepo.findOne.mockResolvedValue(mockProduct);
      categoriesRepo.findOne.mockResolvedValue(null);

      await expect(service.addCategory(1, 999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeCategory', () => {
    it('remove categoria do produto', async () => {
      const productWithCategory = { ...mockProduct, categories: [mockCategory] };
      const productAfter = { ...mockProduct, categories: [] };
      productsRepo.findOne
        .mockResolvedValueOnce(productWithCategory)
        .mockResolvedValueOnce(productAfter);
      categoriesRepo.findOne.mockResolvedValue(mockCategory);
      productsRepo.save.mockResolvedValue(productAfter);

      const result = await service.removeCategory(1, 1);

      expect(result.categories).toHaveLength(0);
    });

    it('lança NotFoundException quando produto não existe', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.removeCategory(999, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança NotFoundException quando categoria não existe', async () => {
      productsRepo.findOne.mockResolvedValue(mockProduct);
      categoriesRepo.findOne.mockResolvedValue(null);

      await expect(service.removeCategory(1, 999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
