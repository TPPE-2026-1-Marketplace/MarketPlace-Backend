import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import {
  CORREIOS_CALC_URL,
  CORREIOS_SERVICO_PAC,
  CORREIOS_TIMEOUT_MS,
  SHIPPING_CACHE_MAX_ENTRIES,
  SHIPPING_CACHE_TTL_MS,
  SHIPPING_PACKAGE_DEFAULTS,
} from '../common/constants';
import { CEP_RANGES } from './data/cep-ranges';
import { CalculateShippingDto } from './dtos/calculate-shipping.dto';
import { IShippingQuote } from './interfaces/shipping.interface';

interface CacheEntry {
  data: IShippingQuote;
  expiresAt: number;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  private readonly cache = new Map<string, CacheEntry>();

  private readonly cepOrigem: string;

  constructor(private readonly httpService: HttpService) {
    const cep = process.env.LOJA_CEP_ORIGEM;
    if (!cep) {
      throw new Error(
        'Variável de ambiente LOJA_CEP_ORIGEM não está definida. ' +
          'Adicione-a ao .env.development (8 dígitos, sem máscara).',
      );
    }
    this.cepOrigem = cep;
    this.logger.log(`CEP de origem configurado: ${this.cepOrigem}`);
  }

  async calculate(dto: CalculateShippingDto): Promise<IShippingQuote> {
    const peso = dto.peso ?? SHIPPING_PACKAGE_DEFAULTS.peso;
    const comprimento = dto.dimensoes?.comprimento ?? SHIPPING_PACKAGE_DEFAULTS.comprimento;
    const largura = dto.dimensoes?.largura ?? SHIPPING_PACKAGE_DEFAULTS.largura;
    const altura = dto.dimensoes?.altura ?? SHIPPING_PACKAGE_DEFAULTS.altura;

    const cacheKey = this.buildCacheKey(dto.cep_destino, peso, comprimento, largura, altura);

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit para CEP ${dto.cep_destino}`);
      return cached;
    }

    this.logger.log(`Consultando Correios: ${this.cepOrigem} → ${dto.cep_destino}`);

    const quote = await this.fetchOrFallback(dto.cep_destino, peso, comprimento, largura, altura);

    this.setInCache(cacheKey, quote);
    return quote;
  }

  private async fetchOrFallback(
    cepDestino: string,
    peso: number,
    comprimento: number,
    largura: number,
    altura: number,
  ): Promise<IShippingQuote> {
    try {
      return await this.fetchFromCorreios(cepDestino, peso, comprimento, largura, altura);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(
          `Correios indisponível para CEP ${cepDestino} — frete calculado via fallback`,
        );
        return this.calculateByRange(cepDestino);
      }
      throw error;
    }
  }

  calculateByRange(cepDestino: string): IShippingQuote {
    const cepInt = parseInt(cepDestino, 10);
    const range = CEP_RANGES.find((r) => cepInt >= r.start && cepInt <= r.end);

    if (!range) {
      this.logger.error(`Fallback sem faixa para CEP ${cepDestino}`);
      throw new ServiceUnavailableException(
        'Serviço dos Correios indisponível e CEP fora das faixas de fallback',
      );
    }

    return { valor: range.valor, prazo_dias: range.prazo_dias };
  }

  private async fetchFromCorreios(
    cepDestino: string,
    peso: number,
    comprimento: number,
    largura: number,
    altura: number,
  ): Promise<IShippingQuote> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<string>(CORREIOS_CALC_URL, {
          params: {
            nCdEmpresa: '',
            sDsSenha: '',
            nCdServico: CORREIOS_SERVICO_PAC,
            sCepOrigem: this.cepOrigem,
            sCepDestino: cepDestino,
            nVlPeso: String(peso),
            nCdFormato: '1',
            nVlComprimento: String(comprimento),
            nVlAltura: String(altura),
            nVlLargura: String(largura),
            nVlDiametro: '0',
            sCdMaoPropria: 'N',
            nVlValorDeclarado: '0',
            sCdAvisoRecebimento: 'N',
            StrRetorno: 'xml',
          },
          timeout: CORREIOS_TIMEOUT_MS,
          responseType: 'text',
        }),
      );

      return this.parseCorreiosXml(response.data);
    } catch (error) {
      // Re-throw se já é uma ServiceUnavailableException (vinda do parse)
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.handleCorreiosError(error);
    }
  }

  private parseCorreiosXml(xml: string): IShippingQuote {
    const erro = this.extractXmlTag(xml, 'Erro');
    const msgErro = this.extractXmlTag(xml, 'MsgErro');

    if (erro && erro !== '0') {
      this.logger.warn(`Correios retornou erro ${erro}: ${msgErro}`);
      throw new ServiceUnavailableException(
        `Erro no serviço dos Correios: ${msgErro || `código ${erro}`}`,
      );
    }

    const valorStr = this.extractXmlTag(xml, 'Valor');
    const prazoStr = this.extractXmlTag(xml, 'PrazoEntrega');

    if (!valorStr || !prazoStr) {
      this.logger.error('Resposta dos Correios com campos ausentes');
      throw new ServiceUnavailableException('Resposta inesperada do serviço dos Correios');
    }

    const valor = parseFloat(valorStr.replace(',', '.'));
    const prazo_dias = parseInt(prazoStr, 10);

    if (isNaN(valor) || isNaN(prazo_dias)) {
      this.logger.error(`Valores inválidos na resposta: valor="${valorStr}", prazo="${prazoStr}"`);
      throw new ServiceUnavailableException('Resposta inesperada do serviço dos Correios');
    }

    return { valor, prazo_dias };
  }

  private extractXmlTag(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match?.[1]?.trim() || null;
  }

  private handleCorreiosError(error: unknown): never {
    const axiosError = error as AxiosError;

    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      this.logger.error(`Timeout ao consultar Correios (limite: ${CORREIOS_TIMEOUT_MS}ms)`);
      throw new ServiceUnavailableException('Serviço dos Correios indisponível (timeout)');
    }

    this.logger.error(`Erro ao consultar Correios: ${axiosError.message}`, axiosError.stack);
    throw new ServiceUnavailableException('Serviço dos Correios indisponível');
  }

  private buildCacheKey(
    cep: string,
    peso: number,
    comprimento: number,
    largura: number,
    altura: number,
  ): string {
    return `${cep}:${peso}:${comprimento}:${largura}:${altura}`;
  }

  private getFromCache(key: string): IShippingQuote | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setInCache(key: string, data: IShippingQuote): void {
    if (this.cache.size >= SHIPPING_CACHE_MAX_ENTRIES) {
      this.evictExpired();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + SHIPPING_CACHE_TTL_MS,
    });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
