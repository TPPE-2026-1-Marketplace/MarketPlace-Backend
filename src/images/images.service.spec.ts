import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { CatalogImage } from './entities/catalog-image.entity';
import { Image } from './entities/image.entity';
import { ImagesService } from './images.service';

const mockImage: Image = {
  idImagem: 1,
  url: 'https://example.com/a.jpg',
  ordem: 0,
  descricao: null,
  localRenderizacao: null,
  catalogImages: [],
};

const mockVariant: ProductVariant = {
  codigoSku: 'SKU-001',
  precoVariante: 99.9,
  ativo: true,
  cor: null,
  tamanho: null,
  medidas: null,
  catalogImages: [],
  product: null as any,
};

const mockCatalogImage: CatalogImage = {
  idImagem: mockImage.idImagem,
  codigoSku: mockVariant.codigoSku,
  ordemNoCatalogo: 0,
  image: mockImage,
  variant: mockVariant,
};

describe('ImagesService', () => {
  let service: ImagesService;
  let imagesRepo: jest.Mocked<Repository<Image>>;
  let catalogImagesRepo: jest.Mocked<Repository<CatalogImage>>;
  let variantsRepo: jest.Mocked<Repository<ProductVariant>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        {
          provide: getRepositoryToken(Image),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CatalogImage),
          useValue: { create: jest.fn(), save: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ImagesService);
    imagesRepo = module.get(getRepositoryToken(Image));
    catalogImagesRepo = module.get(getRepositoryToken(CatalogImage));
    variantsRepo = module.get(getRepositoryToken(ProductVariant));
  });

  describe('createImage', () => {
    it('cria e retorna a imagem', async () => {
      imagesRepo.create.mockReturnValue(mockImage);
      imagesRepo.save.mockResolvedValue(mockImage);

      const result = await service.createImage({
        url: 'https://example.com/a.jpg',
      });

      expect(result).toEqual(mockImage);
      expect(imagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/a.jpg' }),
      );
    });

    it('aplica defaults quando campos opcionais são omitidos', async () => {
      imagesRepo.create.mockReturnValue(mockImage);
      imagesRepo.save.mockResolvedValue(mockImage);

      await service.createImage({ url: 'https://example.com/a.jpg' });

      expect(imagesRepo.create).toHaveBeenCalledWith({
        url: 'https://example.com/a.jpg',
        ordem: 0,
        descricao: null,
        localRenderizacao: null,
      });
    });
  });

  describe('linkImageToVariant', () => {
    it('vincula imagem a variante e retorna o catalog image', async () => {
      imagesRepo.findOne.mockResolvedValue(mockImage);
      variantsRepo.findOne.mockResolvedValue(mockVariant);
      catalogImagesRepo.create.mockReturnValue(mockCatalogImage);
      catalogImagesRepo.save.mockResolvedValue(mockCatalogImage);

      const result = await service.linkImageToVariant({
        imageId: 1,
        variantSku: 'SKU-001',
      });

      expect(result).toEqual(mockCatalogImage);
      expect(catalogImagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idImagem: mockImage.idImagem,
          codigoSku: mockVariant.codigoSku,
        }),
      );
    });

    it('lança NotFoundException quando imagem não existe', async () => {
      imagesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.linkImageToVariant({ imageId: 999, variantSku: 'SKU-001' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(variantsRepo.findOne).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando variante não existe', async () => {
      imagesRepo.findOne.mockResolvedValue(mockImage);
      variantsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.linkImageToVariant({ imageId: 1, variantSku: 'SKU-INEXISTENTE' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findCatalogByVariantSku', () => {
    it('retorna catálogo ordenado por ordemNoCatalogo', async () => {
      const catalogItems: CatalogImage[] = [
        { ...mockCatalogImage, ordemNoCatalogo: 10 },
        { ...mockCatalogImage, ordemNoCatalogo: 20 },
      ];
      variantsRepo.findOne.mockResolvedValue(mockVariant);
      catalogImagesRepo.find.mockResolvedValue(catalogItems);

      const result = await service.findCatalogByVariantSku('SKU-001');

      expect(result).toEqual(catalogItems);
      expect(catalogImagesRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { ordemNoCatalogo: 'ASC' },
        }),
      );
    });

    it('lança NotFoundException quando variante não existe', async () => {
      variantsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findCatalogByVariantSku('SKU-INEXISTENTE'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(catalogImagesRepo.find).not.toHaveBeenCalled();
    });
  });
});
