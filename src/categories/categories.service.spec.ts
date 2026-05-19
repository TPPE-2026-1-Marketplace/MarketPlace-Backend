import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

const mockCategory: Category = {
  idCategoria: 1,
  nome: 'Camisetas',
  products: [],
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: jest.Mocked<Repository<Category>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CategoriesService);
    repo = module.get(getRepositoryToken(Category));
  });

  describe('create', () => {
    it('cria e retorna a categoria', async () => {
      repo.create.mockReturnValue(mockCategory);
      repo.save.mockResolvedValue(mockCategory);

      const result = await service.create({ nome: 'Camisetas' });

      expect(result).toEqual(mockCategory);
      expect(repo.create).toHaveBeenCalledWith({ nome: 'Camisetas' });
      expect(repo.save).toHaveBeenCalledWith(mockCategory);
    });
  });

  describe('findAll', () => {
    it('retorna lista paginada com meta correto', async () => {
      repo.findAndCount.mockResolvedValue([[mockCategory], 1]);

      const result = await service.findAll(1, 20);

      expect(result.data).toEqual([mockCategory]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('calcula totalPages corretamente', async () => {
      repo.findAndCount.mockResolvedValue([[], 25]);

      const result = await service.findAll(1, 10);

      expect(result.meta.totalPages).toBe(3);
    });

    it('aplica skip correto para page > 1', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(3, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('retorna totalPages 1 quando não há registros', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(1, 20);

      expect(result.meta.totalPages).toBe(1);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('retorna a categoria quando id existe', async () => {
      repo.findOne.mockResolvedValue(mockCategory);

      const result = await service.findOne(1);

      expect(result).toEqual(mockCategory);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { idCategoria: 1 } });
    });

    it('lança NotFoundException quando id não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('atualiza e retorna a categoria com o novo nome', async () => {
      const updated: Category = { ...mockCategory, nome: 'Calças' };
      repo.findOne.mockResolvedValue(mockCategory);
      repo.save.mockResolvedValue(updated);

      const result = await service.update(1, { nome: 'Calças' });

      expect(result.nome).toBe('Calças');
    });

    it('lança NotFoundException quando id não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { nome: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove sem erros quando id existe', async () => {
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await expect(service.remove(1)).resolves.toBeUndefined();
    });

    it('lança NotFoundException quando id não existe', async () => {
      repo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
