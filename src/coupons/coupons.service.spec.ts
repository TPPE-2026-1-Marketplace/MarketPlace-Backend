import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';

import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { Product } from '../products/entities/product.entity';

import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

const DAY_MS = 24 * 60 * 60 * 1000;
const past = new Date(Date.now() - DAY_MS);
const future = new Date(Date.now() + 10 * DAY_MS);

function buildCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    numeroDoCupom: 'PROMO10',
    tipoCupom: 'porcentagem',
    valorDesconto: 10,
    ativo: true,
    dataInicio: past,
    dataFim: future,
    usoMaximo: null,
    nomeInfluenciador: null,
    usosAtuais: 0,
    products: [],
    ...overrides,
  };
}

describe('CouponsService', () => {
  let service: CouponsService;
  let couponsRepo: jest.Mocked<Repository<Coupon>>;
  let productsRepo: jest.Mocked<Repository<Product>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: getRepositoryToken(Coupon),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            merge: jest.fn(),
            remove: jest.fn(),
            increment: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CouponsService);
    couponsRepo = module.get(getRepositoryToken(Coupon));
    productsRepo = module.get(getRepositoryToken(Product));
  });

  describe('create', () => {
    it('cria cupom quando o número ainda não existe', async () => {
      const coupon = buildCoupon();
      couponsRepo.findOne.mockResolvedValue(null);
      couponsRepo.create.mockReturnValue(coupon);
      couponsRepo.save.mockResolvedValue(coupon);

      const result = await service.create(coupon as never);

      expect(result).toEqual(coupon);
      expect(couponsRepo.save).toHaveBeenCalledWith(coupon);
    });

    it('lança ConflictException quando o cupom já existe (checagem prévia)', async () => {
      couponsRepo.findOne.mockResolvedValue(buildCoupon());
      await expect(service.create(buildCoupon() as never)).rejects.toThrow(ConflictException);
      expect(couponsRepo.save).not.toHaveBeenCalled();
    });

    it('traduz violação de unicidade do Postgres em ConflictException', async () => {
      couponsRepo.findOne.mockResolvedValue(null);
      couponsRepo.create.mockReturnValue(buildCoupon());
      couponsRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], {
          code: '23505',
        } as unknown as Error),
      );

      await expect(service.create(buildCoupon() as never)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('normaliza o código para maiúsculas e remove espaços', async () => {
      const coupon = buildCoupon();
      couponsRepo.findOne.mockResolvedValue(coupon);

      await service.findOne('  promo10  ');

      expect(couponsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { numeroDoCupom: 'PROMO10' } }),
      );
    });

    it('lança NotFoundException quando não encontra', async () => {
      couponsRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('INEXISTENTE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validate', () => {
    it('retorna invalid quando o cupom não existe', async () => {
      couponsRepo.findOne.mockResolvedValue(null);
      const result = await service.validate('QUALQUER');
      expect(result).toEqual({ valid: false, reason: 'invalid' });
    });

    it.each([
      ['cupom inativo', buildCoupon({ ativo: false }), [], 'invalid'],
      [
        'fora da vigência (já expirou)',
        buildCoupon({ dataInicio: new Date(Date.now() - 5 * DAY_MS), dataFim: past }),
        [],
        'expired',
      ],
      [
        'limite de usos atingido',
        buildCoupon({ usoMaximo: 5, usosAtuais: 5 }),
        [],
        'limit_reached',
      ],
      [
        'produtos não elegíveis',
        buildCoupon({ products: [{ idProduto: 1 } as Product] }),
        [99],
        'ineligible_products',
      ],
    ])('retorna reason=%s quando %s', async (_descricao, coupon, productIds, expectedReason) => {
      couponsRepo.findOne.mockResolvedValue(coupon as Coupon);
      const result = await service.validate('PROMO10', productIds as number[]);
      expect(result).toEqual({ valid: false, reason: expectedReason });
    });

    it('retorna valid com dados do cupom quando tudo confere', async () => {
      couponsRepo.findOne.mockResolvedValue(
        buildCoupon({
          tipoCupom: 'fixo',
          valorDesconto: 25,
          products: [{ idProduto: 1 } as Product],
        }),
      );
      const result = await service.validate('PROMO10', [1]);
      expect(result).toEqual({ valid: true, tipoCupom: 'fixo', valorDesconto: 25 });
    });
  });

  describe('update', () => {
    it('rejeita quando data de fim não é posterior à de início', async () => {
      couponsRepo.findOne.mockResolvedValue(buildCoupon());
      await expect(
        service.update('PROMO10', {
          dataInicio: future.toISOString(),
          dataFim: past.toISOString(),
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita desconto acima de 100% para cupom de porcentagem', async () => {
      couponsRepo.findOne.mockResolvedValue(buildCoupon({ tipoCupom: 'porcentagem' }));
      await expect(service.update('PROMO10', { valorDesconto: 150 } as never)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('incrementUsage', () => {
    it('lança NotFoundException quando nenhum registro é afetado', async () => {
      couponsRepo.increment.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });
      await expect(service.incrementUsage('PROMO10')).rejects.toThrow(NotFoundException);
    });

    it('incrementa normalizando o código', async () => {
      couponsRepo.increment.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      await service.incrementUsage(' promo10 ');
      expect(couponsRepo.increment).toHaveBeenCalledWith(
        { numeroDoCupom: 'PROMO10' },
        'usosAtuais',
        1,
      );
    });
  });

  it('mantém productsRepo disponível para associação', () => {
    expect(productsRepo).toBeDefined();
  });
});
