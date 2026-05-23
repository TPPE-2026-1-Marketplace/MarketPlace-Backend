import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import {
  MELHOR_ENVIO_CALC_PATH,
  MELHOR_ENVIO_TIMEOUT_MS,
  SHIPPING_CACHE_MAX_ENTRIES,
  SHIPPING_CACHE_TTL_MS,
  SHIPPING_PACKAGE_DEFAULTS,
} from '../common/constants';
import { MelhorEnvioTokenManager } from './auth/melhor-envio-token-manager';
import { CEP_RANGES } from './data/cep-ranges';
import { CalculateShippingDto } from './dtos/calculate-shipping.dto';
import { IMelhorEnvioCotacao } from './interfaces/melhor-envio.interface';
import { IShippingQuote } from './interfaces/shipping.interface';

interface CacheEntry {
  data: IShippingQuote;
  expiresAt: number;
}

interface PackageDimensions {
  peso: number;
  comprimento: number;
  largura: number;
  altura: number;
}

const HTTP_UNAUTHORIZED = 401;
const HTTP_UNPROCESSABLE = 422;

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cepOrigem: string;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly serviceId: number | null;

  constructor(
    private readonly httpService: HttpService,
    private readonly tokenManager: MelhorEnvioTokenManager,
  ) {
    const cep = process.env.LOJA_CEP_ORIGEM;
    if (!cep) {
      throw new Error('Variável de ambiente LOJA_CEP_ORIGEM não está definida.');
    }
    this.cepOrigem = cep;

    this.baseUrl = process.env.MELHOR_ENVIO_BASE_URL as string;
    this.userAgent = process.env.MELHOR_ENVIO_USER_AGENT as string;

    const sid = process.env.MELHOR_ENVIO_SERVICE_ID;
    this.serviceId = sid ? parseInt(sid, 10) : null;

    this.logger.log(
      `CEP origem: ${this.cepOrigem}. Service ID: ${this.serviceId ?? '(mais barato)'}.`,
    );
  }

  /**
   * Calcula o frete para o CEP de destino informado.
   *
   * Fluxo:
   * 1. Resolve valores padrão para peso/dimensões opcionais.
   * 2. Verifica cache em memória (TTL 30 min). Chave inclui service_id.
   * 3. Cache miss → consulta Melhor Envio (timeout 5 s).
   * 4. Qualquer falha do provedor cai no fallback por faixa de CEP.
   * 5. 422 (payload inválido) propaga como BadRequestException.
   */
  async calculate(dto: CalculateShippingDto): Promise<IShippingQuote> {
    const pkg = this.resolvePackage(dto);
    const cacheKey = this.buildCacheKey(dto.cep_destino, pkg);

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit para CEP ${dto.cep_destino}`);
      return cached;
    }

    const quote = await this.fetchOrFallback(dto.cep_destino, pkg);
    this.setInCache(cacheKey, quote);
    return quote;
  }

  /**
   * Tenta a Melhor Envio; se cair em qualquer falha do provedor
   * (timeout, 401, 5xx, cotações todas com erro), cai no fallback por faixa.
   * 422 (BadRequestException) sobe pro caller — é erro do cliente.
   */
  private async fetchOrFallback(
    cepDestino: string,
    pkg: PackageDimensions,
  ): Promise<IShippingQuote> {
    try {
      return await this.fetchFromMelhorEnvio(cepDestino, pkg);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(
          `Melhor Envio indisponível para CEP ${cepDestino} — frete calculado via fallback`,
        );
        return this.calculateByRange(cepDestino);
      }
      throw error;
    }
  }

  // ─── Fallback por faixa de CEP (Plano B / Issue #77) ──────────────────

  calculateByRange(cepDestino: string): IShippingQuote {
    const cepInt = parseInt(cepDestino, 10);
    const range = CEP_RANGES.find((r) => cepInt >= r.start && cepInt <= r.end);
    if (!range) {
      this.logger.error(`Fallback sem faixa para CEP ${cepDestino}`);
      throw new ServiceUnavailableException(
        'Serviço de frete indisponível e CEP fora das faixas de fallback',
      );
    }
    return { valor: range.valor, prazo_dias: range.prazo_dias };
  }

  // ─── Melhor Envio ─────────────────────────────────────────────────────

  private async fetchFromMelhorEnvio(
    cepDestino: string,
    pkg: PackageDimensions,
  ): Promise<IShippingQuote> {
    const accessToken = await this.tokenManager.getValidAccessToken();

    let cotacoes: IMelhorEnvioCotacao[];
    try {
      const response = await firstValueFrom(
        this.httpService.post<IMelhorEnvioCotacao[]>(
          `${this.baseUrl}${MELHOR_ENVIO_CALC_PATH}`,
          this.buildRequestBody(cepDestino, pkg),
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': this.userAgent,
            },
            timeout: MELHOR_ENVIO_TIMEOUT_MS,
          },
        ),
      );
      cotacoes = response.data;
    } catch (error) {
      this.handleMelhorEnvioError(error);
    }

    return this.pickQuoteFromCotacoes(cotacoes, cepDestino);
  }

  private buildRequestBody(cepDestino: string, pkg: PackageDimensions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      from: { postal_code: this.cepOrigem },
      to: { postal_code: cepDestino },
      package: {
        height: pkg.altura,
        width: pkg.largura,
        length: pkg.comprimento,
        weight: pkg.peso,
      },
    };
    if (this.serviceId !== null) {
      body.services = String(this.serviceId);
    }
    return body;
  }

  /**
   * Filtra cotações com erro, escolhe uma (service específico ou mais barata)
   * e converte pra IShippingQuote. Se todas falharem, lança ServiceUnavailable.
   */
  private pickQuoteFromCotacoes(
    cotacoes: IMelhorEnvioCotacao[],
    cepDestino: string,
  ): IShippingQuote {
    const validas = cotacoes.filter((c) => !c.error);
    if (validas.length === 0) {
      const erros = cotacoes
        .filter((c) => c.error)
        .map((c) => `${c.name}: ${c.error as string}`)
        .join('; ');
      this.logger.warn(`Sem cotações válidas para CEP ${cepDestino}. Erros: ${erros}`);
      throw new ServiceUnavailableException('Nenhum serviço disponível para o CEP informado');
    }

    const escolhida =
      this.serviceId !== null
        ? (validas.find((c) => c.id === this.serviceId) ?? this.cheapest(validas))
        : this.cheapest(validas);

    const valorStr = escolhida.custom_price ?? escolhida.price;
    const prazo = escolhida.custom_delivery_time ?? escolhida.delivery_time;
    if (!valorStr || prazo === undefined) {
      this.logger.error(`Cotação ${escolhida.id} sem preço/prazo: ${JSON.stringify(escolhida)}`);
      throw new ServiceUnavailableException('Resposta inesperada da Melhor Envio');
    }

    return { valor: parseFloat(valorStr), prazo_dias: prazo };
  }

  private cheapest(cotacoes: IMelhorEnvioCotacao[]): IMelhorEnvioCotacao {
    return cotacoes.reduce((min, c) => {
      const priceMin = parseFloat(min.custom_price ?? min.price ?? 'Infinity');
      const priceC = parseFloat(c.custom_price ?? c.price ?? 'Infinity');
      return priceC < priceMin ? c : min;
    });
  }

  /**
   * Converte erros do Axios na semântica correta:
   * - 422 → BadRequestException (erro do cliente, propaga)
   * - 401 → invalida cache do token e lança ServiceUnavailable (cai no fallback)
   * - timeout/5xx/network → ServiceUnavailable (cai no fallback)
   */
  private handleMelhorEnvioError(error: unknown): never {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;

    if (status === HTTP_UNPROCESSABLE) {
      const data = axiosError.response?.data as { message?: string } | undefined;
      const msg = data?.message ?? 'Payload inválido para a Melhor Envio';
      this.logger.warn(`Melhor Envio rejeitou payload (422): ${msg}`);
      throw new BadRequestException(msg);
    }

    if (status === HTTP_UNAUTHORIZED) {
      this.tokenManager.invalidate();
      this.logger.error('Melhor Envio retornou 401 — token inválido. Cache invalidado.');
      throw new ServiceUnavailableException('Falha na autenticação com a Melhor Envio');
    }

    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      this.logger.error(`Timeout ao consultar Melhor Envio (limite: ${MELHOR_ENVIO_TIMEOUT_MS}ms)`);
      throw new ServiceUnavailableException('Melhor Envio indisponível (timeout)');
    }

    this.logger.error(`Erro ao consultar Melhor Envio: ${axiosError.message}`, axiosError.stack);
    throw new ServiceUnavailableException('Melhor Envio indisponível');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private resolvePackage(dto: CalculateShippingDto): PackageDimensions {
    return {
      peso: dto.peso ?? SHIPPING_PACKAGE_DEFAULTS.peso,
      comprimento: dto.dimensoes?.comprimento ?? SHIPPING_PACKAGE_DEFAULTS.comprimento,
      largura: dto.dimensoes?.largura ?? SHIPPING_PACKAGE_DEFAULTS.largura,
      altura: dto.dimensoes?.altura ?? SHIPPING_PACKAGE_DEFAULTS.altura,
    };
  }

  private buildCacheKey(cep: string, pkg: PackageDimensions): string {
    const sid = this.serviceId ?? 'cheapest';
    return `${sid}:${cep}:${pkg.peso}:${pkg.comprimento}:${pkg.largura}:${pkg.altura}`;
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
    this.cache.set(key, { data, expiresAt: Date.now() + SHIPPING_CACHE_TTL_MS });
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
