import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';

import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';
import { PG_UNIQUE_VIOLATION } from '../common/constants';
import { Order } from '../orders/entities/order.entity';
import { Person } from '../people/entities/person.entity';
import { Product } from '../products/entities/product.entity';

import type { CreateReviewDto } from './dtos/create-review.dto';
import type { TestingModule } from '@nestjs/testing';
import type { DataSource, EntityManager, Repository } from 'typeorm';

const CPF_CLIENTE = '11122233344';
const ID_PRODUTO = 1;

const mockPerson: Person = {
  cpf: CPF_CLIENTE,
  nome: 'Cliente Teste',
  email: 'cliente@test.com',
  telefone: null,
  senha: null,
};

// Factory (não um objeto compartilhado): o service muta o produto retornado
// por `manager.findOne(Product, ...)` (updateProductStatsTransactional grava
// mediaAvaliacao/totalAvaliacoes nele antes do save). Reusar a mesma instância
// entre testes faria um teste vazar estado mutado para o próximo.
const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  idProduto: ID_PRODUTO,
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
  mediaAvaliacao: 4.5,
  totalAvaliacoes: 2,
  categories: [],
  variants: [],
  coupons: [],
  ...overrides,
});

const mockReview: Review = {
  cpfCliente: CPF_CLIENTE,
  idProduto: ID_PRODUTO,
  nota: 5,
  comentario: 'Ótimo produto',
  dataAvaliacao: new Date('2026-01-01'),
  cliente: mockPerson,
  produto: buildProduct(),
};

const makeQueryBuilder = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(1),
  getRawMany: jest.fn().mockResolvedValue([]),
  getRawOne: jest.fn().mockResolvedValue({ avg: '5', count: '1' }),
  ...overrides,
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewsRepo: jest.Mocked<Repository<Review>>;
  let productsRepo: jest.Mocked<Repository<Product>>;

  let managerPeopleRepo: { findOne: jest.Mock };
  let managerProductsRepo: { findOne: jest.Mock };
  let managerOrdersRepo: { createQueryBuilder: jest.Mock };
  let managerReviewsRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let managerFindOne: jest.Mock;
  let managerSave: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    managerPeopleRepo = { findOne: jest.fn().mockResolvedValue(mockPerson) };
    managerProductsRepo = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(buildProduct())),
    };
    managerOrdersRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder()) };
    managerReviewsRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue(mockReview),
      save: jest.fn().mockResolvedValue(mockReview),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder()),
    };
    managerFindOne = jest.fn().mockImplementation(() => Promise.resolve(buildProduct()));
    managerSave = jest.fn().mockImplementation((entity: Product) => Promise.resolve(entity));

    const mockManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Person) return managerPeopleRepo;
        if (entity === Product) return managerProductsRepo;
        if (entity === Order) return managerOrdersRepo;
        if (entity === Review) return managerReviewsRepo;
        throw new Error(`Repositório não mockado para ${String(entity)}`);
      }),
      findOne: managerFindOne,
      save: managerSave,
    } as unknown as EntityManager;

    const mockDataSource = {
      transaction: jest.fn((cb: (manager: EntityManager) => Promise<unknown>) => cb(mockManager)),
    } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: { find: jest.fn(), findAndCount: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Person),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get(ReviewsService);
    reviewsRepo = module.get(getRepositoryToken(Review));
    productsRepo = module.get(getRepositoryToken(Product));
  });

  const createDto: CreateReviewDto = {
    idProduto: ID_PRODUTO,
    nota: 5,
    comentario: 'Ótimo produto',
  };

  describe('create', () => {
    it('cria a avaliação quando cliente comprou o produto e ainda não avaliou', async () => {
      const result = await service.create(CPF_CLIENTE, createDto);

      expect(result).toEqual(mockReview);
      expect(managerReviewsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cpfCliente: CPF_CLIENTE, idProduto: ID_PRODUTO, nota: 5 }),
      );
      expect(managerSave).toHaveBeenCalled();
    });

    it('lança NotFoundException quando o cliente não existe', async () => {
      managerPeopleRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.create(CPF_CLIENTE, createDto)).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando o produto não existe', async () => {
      managerProductsRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.create(CPF_CLIENTE, createDto)).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o cliente não comprou o produto', async () => {
      managerOrdersRepo.createQueryBuilder.mockReturnValueOnce(
        makeQueryBuilder({ getCount: jest.fn().mockResolvedValue(0) }),
      );

      await expect(service.create(CPF_CLIENTE, createDto)).rejects.toThrow(ForbiddenException);
    });

    it('lança ConflictException quando o cliente já avaliou o produto (checagem prévia)', async () => {
      managerReviewsRepo.findOne.mockResolvedValueOnce(mockReview);

      await expect(service.create(CPF_CLIENTE, createDto)).rejects.toThrow(ConflictException);
    });

    it('lança ConflictException em corrida de concorrência (unique violation no save)', async () => {
      const uniqueViolationError = Object.create(QueryFailedError.prototype);
      uniqueViolationError.driverError = { code: PG_UNIQUE_VIOLATION };
      managerReviewsRepo.save.mockRejectedValueOnce(uniqueViolationError);

      await expect(service.create(CPF_CLIENTE, createDto)).rejects.toThrow(ConflictException);
    });

    it('propaga erros inesperados do save', async () => {
      const unexpectedError = new Error('erro de conexão');
      managerReviewsRepo.save.mockRejectedValueOnce(unexpectedError);

      await expect(service.create(CPF_CLIENTE, createDto)).rejects.toThrow(unexpectedError);
    });

    it('remove tags HTML do comentário para evitar XSS (mantém o texto)', async () => {
      await service.create(CPF_CLIENTE, {
        ...createDto,
        comentario: '<b>Muito bom</b>',
      });

      expect(managerReviewsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ comentario: 'Muito bom' }),
      );
    });

    it('grava comentário null quando, após sanitização, o texto fica vazio', async () => {
      await service.create(CPF_CLIENTE, { ...createDto, comentario: '<b></b>' });

      expect(managerReviewsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ comentario: null }),
      );
    });

    it('recalcula média e total do produto após criar a avaliação', async () => {
      await service.create(CPF_CLIENTE, createDto);

      expect(managerFindOne).toHaveBeenCalledWith(
        Product,
        expect.objectContaining({
          where: { idProduto: ID_PRODUTO },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(managerSave).toHaveBeenCalledWith(
        expect.objectContaining({ mediaAvaliacao: 5, totalAvaliacoes: 1 }),
      );
    });
  });

  describe('findByProduct', () => {
    it('retorna as avaliações do produto ordenadas por data', async () => {
      productsRepo.findOne.mockResolvedValue(buildProduct());
      reviewsRepo.find.mockResolvedValue([mockReview]);

      const result = await service.findByProduct(ID_PRODUTO);

      expect(result).toEqual([mockReview]);
      expect(reviewsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { idProduto: ID_PRODUTO } }),
      );
    });

    it('lança NotFoundException quando o produto não existe', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.findByProduct(ID_PRODUTO)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProductPaginated', () => {
    it('lança NotFoundException quando o produto não existe', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.findByProductPaginated(ID_PRODUTO, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna dados paginados sem expor o CPF do cliente', async () => {
      productsRepo.findOne.mockResolvedValue(buildProduct());
      reviewsRepo.findAndCount.mockResolvedValue([[mockReview], 1]);
      reviewsRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([{ nota: 5, count: '1' }]),
        }) as never,
      );

      const result = await service.findByProductPaginated(ID_PRODUTO, 1, 10);

      expect(result.data).toEqual([
        {
          idProduto: ID_PRODUTO,
          nota: 5,
          comentario: 'Ótimo produto',
          dataAvaliacao: mockReview.dataAvaliacao,
          cliente: { nome: 'Cliente Teste' },
        },
      ]);
      expect(result.data[0]).not.toHaveProperty('cpfCliente');
      expect(result.media).toBe(4.5);
      expect(result.totalAvaliacoes).toBe(2);
      expect(result.distribuicao).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 1 });
    });

    it('usa "Cliente Anônimo" quando o nome do cliente não está preenchido', async () => {
      productsRepo.findOne.mockResolvedValue(buildProduct());
      reviewsRepo.findAndCount.mockResolvedValue([
        [{ ...mockReview, cliente: { ...mockPerson, nome: null } }],
        1,
      ]);
      reviewsRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder() as never);

      const result = await service.findByProductPaginated(ID_PRODUTO, 1, 10);

      expect(result.data[0].cliente.nome).toBe('Cliente Anônimo');
    });
  });

  describe('remove', () => {
    it('remove a avaliação e recalcula as estatísticas do produto', async () => {
      managerReviewsRepo.findOne.mockResolvedValueOnce(mockReview);

      await service.remove(CPF_CLIENTE, ID_PRODUTO);

      expect(managerReviewsRepo.remove).toHaveBeenCalledWith(mockReview);
      expect(managerSave).toHaveBeenCalled();
    });

    it('lança NotFoundException quando a avaliação não existe', async () => {
      managerReviewsRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.remove(CPF_CLIENTE, ID_PRODUTO)).rejects.toThrow(NotFoundException);
    });
  });
});
