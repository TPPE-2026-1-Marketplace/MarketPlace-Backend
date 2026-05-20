import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { UpdateStockDto } from './dtos/update-stock.dto';
import { Stock } from './entities/stock.entity';
import { MovementType, StockLog } from './entities/stock-log.entity';

interface LogFilters {
  tipoMovimentacao?: MovementType;
  dataInicio?: Date;
  dataFim?: Date;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(StockLog)
    private readonly stockLogRepository: Repository<StockLog>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
  ) {}

  async findPublic(
    codigoSku: string,
  ): Promise<{ qtdOnline: number; qtdLojaFisica: number }> {
    const variantExists = await this.variantRepository.existsBy({ codigoSku });
    if (!variantExists) {
      throw new NotFoundException(
        `Variante com SKU ${codigoSku} não encontrada`,
      );
    }

    const stock = await this.stockRepository.findOne({ where: { codigoSku } });
    return {
      qtdOnline: stock?.qtdOnline ?? 0,
      qtdLojaFisica: stock?.qtdLojaFisica ?? 0,
    };
  }

  async findBySku(codigoSku: string): Promise<Stock> {
    const stock = await this.stockRepository.findOne({ where: { codigoSku } });
    if (!stock) {
      throw new NotFoundException(
        `Estoque para SKU ${codigoSku} não encontrado`,
      );
    }
    return stock;
  }

  async adjust(
    codigoSku: string,
    dto: UpdateStockDto,
    origem?: string,
  ): Promise<Stock> {
    let stock = await this.stockRepository.findOne({ where: { codigoSku } });

    if (!stock) {
      const variantExists = await this.variantRepository.existsBy({ codigoSku });
      if (!variantExists) {
        throw new NotFoundException(
          `Variante com SKU ${codigoSku} não encontrada`,
        );
      }
      stock = this.stockRepository.create({ codigoSku, qtdOnline: 0, qtdLojaFisica: 0 });
    }

    const anteriorOnline = stock.qtdOnline;
    const anteriorLoja = stock.qtdLojaFisica;

    stock.qtdOnline = dto.qtdOnline ?? anteriorOnline;
    stock.qtdLojaFisica = dto.qtdLojaFisica ?? anteriorLoja;

    await this.stockRepository.save(stock);

    const quantidadeMovimentada =
      Math.abs(stock.qtdOnline - anteriorOnline) +
      Math.abs(stock.qtdLojaFisica - anteriorLoja);

    const log = this.stockLogRepository.create({
      codigoSku,
      tipoMovimentacao: dto.tipoMovimentacao,
      quantidadeMovimentada,
      valorAnteriorOnline: anteriorOnline,
      valorNovoOnline: stock.qtdOnline,
      valorAnteriorLoja: anteriorLoja,
      valorNovoLoja: stock.qtdLojaFisica,
      origem: origem ?? null,
      motivo: dto.motivo ?? null,
      idPedido: null,
    });

    await this.stockLogRepository.save(log);

    return stock;
  }

  async getLogs(
    codigoSku: string,
    page: number,
    limit: number,
    filters: LogFilters = {},
  ): Promise<{
    data: StockLog[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: FindOptionsWhere<StockLog> = { codigoSku };

    if (filters.tipoMovimentacao) {
      where.tipoMovimentacao = filters.tipoMovimentacao;
    }

    if (filters.dataInicio && filters.dataFim) {
      where.dataCriacao = Between(filters.dataInicio, filters.dataFim);
    } else if (filters.dataInicio) {
      where.dataCriacao = MoreThanOrEqual(filters.dataInicio);
    } else if (filters.dataFim) {
      where.dataCriacao = LessThanOrEqual(filters.dataFim);
    }

    const [rows, total] = await this.stockLogRepository.findAndCount({
      where,
      order: { dataCriacao: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
