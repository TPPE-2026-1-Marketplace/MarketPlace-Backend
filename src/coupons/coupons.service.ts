import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, QueryFailedError, Repository } from 'typeorm';

import { CreateCouponDto } from './dtos/create-coupon.dto';
import { UpdateCouponDto } from './dtos/update-coupon.dto';
import { Coupon } from './entities/coupon.entity';
import { PERCENTAGE_MAX, PG_UNIQUE_VIOLATION } from '../common/constants';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponsRepository: Repository<Coupon>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /**
   * Cadastra um novo cupom de desconto.
   */
  async create(dto: CreateCouponDto): Promise<Coupon> {
    const existingCoupon = await this.couponsRepository.findOne({
      where: { numeroDoCupom: dto.numeroDoCupom },
    });
    if (existingCoupon) {
      throw new ConflictException('Cupom já cadastrado com este número');
    }

    const coupon = this.couponsRepository.create({
      numeroDoCupom: dto.numeroDoCupom,
      tipoCupom: dto.tipoCupom,
      valorDesconto: dto.valorDesconto,
      ativo: dto.ativo,
      dataInicio: dto.dataInicio,
      dataFim: dto.dataFim,
      usoMaximo: dto.usoMaximo ?? null,
      nomeInfluenciador: dto.nomeInfluenciador ?? null,
      usosAtuais: 0,
    });

    try {
      return await this.couponsRepository.save(coupon);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Cupom já cadastrado com este número');
      }
      throw err;
    }
  }

  /**
   * Busca todos os cupons (Admin).
   */
  async findAll(): Promise<Coupon[]> {
    return this.couponsRepository.find({ relations: { products: true } });
  }

  /**
   * Busca um cupom pelo código.
   */
  async findOne(numeroDoCupom: string): Promise<Coupon> {
    const coupon = await this.couponsRepository.findOne({
      where: { numeroDoCupom: numeroDoCupom.toUpperCase().trim() },
      relations: { products: true },
    });
    if (!coupon) {
      throw new NotFoundException(`Cupom com código ${numeroDoCupom} não encontrado`);
    }
    return coupon;
  }

  /**
   * Atualiza parcialmente um cupom (Admin).
   */
  // eslint-disable-next-line complexity
  async update(numeroDoCupom: string, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.findOne(numeroDoCupom);

    // Validação de segurança para datas modificadas
    const dataInicio = dto.dataInicio ?? coupon.dataInicio;
    const dataFim = dto.dataFim ?? coupon.dataFim;
    if (dataFim <= dataInicio) {
      throw new BadRequestException('A data de fim deve ser posterior à data de início');
    }

    // Validação de segurança para tipoCupom e valorDesconto de porcentagem
    const tipoCupom = dto.tipoCupom ?? coupon.tipoCupom;
    const valorDesconto = dto.valorDesconto ?? Number(coupon.valorDesconto);
    if (tipoCupom === 'porcentagem' && valorDesconto > PERCENTAGE_MAX) {
      throw new BadRequestException('Para cupons do tipo porcentagem, o desconto máximo é de 100%');
    }

    // Mesclar atualizações
    const updated = this.couponsRepository.merge(coupon, {
      ...dto,
      usoMaximo: dto.usoMaximo === null ? null : (dto.usoMaximo ?? coupon.usoMaximo),
      nomeInfluenciador:
        dto.nomeInfluenciador === null ? null : (dto.nomeInfluenciador ?? coupon.nomeInfluenciador),
    });

    return this.couponsRepository.save(updated);
  }

  /**
   * Remove um cupom (Admin - Hard Delete).
   */
  async delete(numeroDoCupom: string): Promise<void> {
    const coupon = await this.findOne(numeroDoCupom);
    await this.couponsRepository.remove(coupon);
  }

  /**
   * Associa um produto a um cupom de desconto (Admin).
   */
  async associateProduct(numeroDoCupom: string, idProduto: number): Promise<void> {
    const coupon = await this.findOne(numeroDoCupom);
    const product = await this.productsRepository.findOne({ where: { idProduto } });
    if (!product) {
      throw new NotFoundException(`Produto com ID ${idProduto} não encontrado`);
    }

    if (!coupon.products.some((p) => p.idProduto === idProduto)) {
      coupon.products.push(product);
      await this.couponsRepository.save(coupon);
    }
  }

  /**
   * Desassocia um produto de um cupom de desconto (Admin).
   */
  async disassociateProduct(numeroDoCupom: string, idProduto: number): Promise<void> {
    const coupon = await this.findOne(numeroDoCupom);
    const product = await this.productsRepository.findOne({ where: { idProduto } });
    if (!product) {
      throw new NotFoundException(`Produto com ID ${idProduto} não encontrado`);
    }

    coupon.products = coupon.products.filter((p) => p.idProduto !== idProduto);
    await this.couponsRepository.save(coupon);
  }

  /**
   * Lista todos os cupons de um influenciador/parceiro específico (Admin).
   * Suporta busca exata insensível a maiúsculas/minúsculas.
   */
  async findByInfluencer(nome: string): Promise<Coupon[]> {
    return this.couponsRepository.find({
      where: { nomeInfluenciador: ILike(nome.trim()) },
      relations: { products: true },
    });
  }

  /**
   * Valida publicamente um cupom.
   */
  // eslint-disable-next-line complexity
  async validate(
    numeroDoCupom: string,
    productIds: number[] = [],
  ): Promise<{
    valid: boolean;
    reason?: 'invalid' | 'expired' | 'limit_reached' | 'ineligible_products';
    tipoCupom?: string;
    valorDesconto?: number;
  }> {
    const coupon = await this.couponsRepository.findOne({
      where: { numeroDoCupom: numeroDoCupom.toUpperCase().trim() },
      relations: { products: true },
    });

    if (!coupon || !coupon.ativo) {
      return { valid: false, reason: 'invalid' };
    }

    const now = new Date();
    if (now < coupon.dataInicio || now > coupon.dataFim) {
      return { valid: false, reason: 'expired' };
    }

    if (coupon.usoMaximo !== null && coupon.usosAtuais >= coupon.usoMaximo) {
      return { valid: false, reason: 'limit_reached' };
    }

    // Regra US13: Se o cupom está associado a produtos específicos
    if (coupon.products && coupon.products.length > 0) {
      const couponProductIds = coupon.products.map((p) => p.idProduto);
      const isEligible = productIds.some((id) => couponProductIds.includes(id));
      if (!isEligible) {
        return { valid: false, reason: 'ineligible_products' };
      }
    }

    return {
      valid: true,
      tipoCupom: coupon.tipoCupom,
      valorDesconto: Number(coupon.valorDesconto),
    };
  }

  /**
   * Incrementa o contador de utilizações atuais de um cupom de forma atômica no banco de dados.
   */
  async incrementUsage(numeroDoCupom: string): Promise<void> {
    const normalized = numeroDoCupom.toUpperCase().trim();
    const result = await this.couponsRepository.increment(
      { numeroDoCupom: normalized },
      'usosAtuais',
      1,
    );
    if (result.affected === 0) {
      throw new NotFoundException(`Cupom com código ${numeroDoCupom} não encontrado`);
    }
  }
}
