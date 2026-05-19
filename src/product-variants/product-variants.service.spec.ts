import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductVariantsService } from './product-variants.service';

const mockProduct: Product = {
  idProduto: 1,
  titulo: 'Camiseta',
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

const mockVariant: ProductVariant = {
  codigoSku: 'CAM-001-P',
  precoVariante: 99.9,
  ativo: true,
  cor: null,
  tamanho: 'P',
  medidas: null,
  catalogImages: [],
  product: mockProduct,
};

describe('ProductVariantsService', () => {
  let service: ProductVariantsService;
  let variantsRepo: jest.Mocked<Repository<ProductVariant>>;
  let productsRepo: jest.Mocked<Repository<Product>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductVariantsService,
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ProductVariantsService);
    variantsRepo = module.get(getRepositoryToken(ProductVariant));
    productsRepo = module.get(getRepositoryToken(Product));
  });

  describe('create', () => {
    it('cria e retorna a variante', async () => {
      productsRepo.findOne.mockResolvedValue(mockProduct);
      variantsRepo.create.mockReturnValue(mockVariant);
      variantsRepo.save.mockResolvedValue(mockVariant);

      const result = await service.create({
        idProduto: 1,
        codigo_sku: 'CAM-001-P',
        preco_variante: 99.9,
        tamanho: 'P',
      });

      expect(result).toEqual(mockVariant);
      expect(variantsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ codigoSku: 'CAM-001-P', precoVariante: 99.9 }),
      );
    });

    it('aplica defaults para campos opcionais omitidos', async () => {
      productsRepo.findOne.mockResolvedValue(mockProduct);
      variantsRepo.create.mockReturnValue(mockVariant);
      variantsRepo.save.mockResolvedValue(mockVariant);

      await service.create({ idProduto: 1, codigo_sku: 'SKU-X', preco_variante: 50 });

      expect(variantsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ativo: true, cor: null, tamanho: null }),
      );
    });

    it('lança NotFoundException quando produto não existe', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ idProduto: 999, codigo_sku: 'SKU-X', preco_variante: 50 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(variantsRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('retorna lista paginada com meta correto', async () => {
      variantsRepo.findAndCount.mockResolvedValue([[mockVariant], 1]);

      const result = await service.findAll({ page: 1, limit: 20, ativo: true });

      expect(result.data).toEqual([mockVariant]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('filtra por ativo=true por padrão', async () => {
      variantsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20, ativo: true });

      expect(variantsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ativo: true } }),
      );
    });

    it('filtra por ativo=false quando explicitado', async () => {
      variantsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20, ativo: false });

      expect(variantsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ativo: false } }),
      );
    });

    it('calcula totalPages corretamente', async () => {
      variantsRepo.findAndCount.mockResolvedValue([[], 25]);

      const result = await service.findAll({ page: 1, limit: 10, ativo: true });

      expect(result.meta.totalPages).toBe(3);
    });

    it('retorna totalPages 1 quando não há registros', async () => {
      variantsRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 20, ativo: true });

      expect(result.meta.totalPages).toBe(1);
    });

    it('aplica skip correto para page > 1', async () => {
      variantsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 3, limit: 10, ativo: true });

      expect(variantsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('retorna a variante quando SKU existe', async () => {
      variantsRepo.findOne.mockResolvedValue(mockVariant);

      const result = await service.findOne('CAM-001-P');

      expect(result).toEqual(mockVariant);
      expect(variantsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { codigoSku: 'CAM-001-P' } }),
      );
    });

    it('lança NotFoundException quando SKU não existe', async () => {
      variantsRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('INEXISTENTE')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('atualiza e retorna a variante', async () => {
      const updated = { ...mockVariant, tamanho: 'M' };
      variantsRepo.findOne
        .mockResolvedValueOnce(mockVariant)
        .mockResolvedValueOnce(updated);
      variantsRepo.save.mockResolvedValue(updated);

      const result = await service.update('CAM-001-P', { tamanho: 'M' });

      expect(result.tamanho).toBe('M');
    });

    it('atualiza o campo medidas', async () => {
      const medidas = { busto: 90, cintura: 70 };
      const updated = { ...mockVariant, medidas };
      variantsRepo.findOne
        .mockResolvedValueOnce(mockVariant)
        .mockResolvedValueOnce(updated);
      variantsRepo.save.mockResolvedValue(updated);

      const result = await service.update('CAM-001-P', { medidas });

      expect(result.medidas).toEqual(medidas);
    });

    it('preserva medidas existentes quando não enviadas no payload', async () => {
      const variantWithMedidas = { ...mockVariant, medidas: { busto: 90 } };
      variantsRepo.findOne
        .mockResolvedValueOnce(variantWithMedidas)
        .mockResolvedValueOnce(variantWithMedidas);
      variantsRepo.save.mockResolvedValue(variantWithMedidas);

      await service.update('CAM-001-P', { tamanho: 'G' });

      expect(variantsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ medidas: { busto: 90 } }),
      );
    });

    it('lança NotFoundException quando SKU não existe', async () => {
      variantsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('INEXISTENTE', { tamanho: 'M' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove sem erros quando SKU existe', async () => {
      variantsRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await expect(service.remove('CAM-001-P')).resolves.toBeUndefined();
    });

    it('lança NotFoundException quando SKU não existe', async () => {
      variantsRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove('INEXISTENTE')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
