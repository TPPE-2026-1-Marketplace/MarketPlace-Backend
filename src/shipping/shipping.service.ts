import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { CalculateShippingDto } from './dtos/calculate-shipping.dto';
import { IShippingQuote } from './interfaces/shipping.interface';

/** Timeout máximo para chamadas à API dos Correios (5 s). */
const CORREIOS_TIMEOUT_MS = 5_000;

/** TTL do cache em memória (30 min). */
const CACHE_TTL_MS = 30 * 60 * 1_000;

/**
 * Limite de entradas no cache antes de disparar eviction.
 * Evita crescimento ilimitado de memória em cenários de alto tráfego.
 */
const CACHE_MAX_ENTRIES = 500;

/** Endpoint público do calculador de preços e prazos dos Correios. */
const CORREIOS_CALC_URL =
  'http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx';

/** Código do serviço PAC (sem contrato). */
const SERVICO_PAC = '04510';

/**
 * Valores padrão usados quando peso/dimensões não são informados.
 * Correspondem aos mínimos aceitos pela API dos Correios para formato caixa.
 */
const DEFAULTS = {
  peso: 0.3, // kg
  comprimento: 16, // cm
  largura: 11, // cm
  altura: 2, // cm
};

interface CacheEntry {
  data: IShippingQuote;
  expiresAt: number;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  /** Cache em memória indexado por chave composta (cep + parâmetros). */
  private readonly cache = new Map<string, CacheEntry>();

  /** CEP de origem da loja, carregado de `LOJA_CEP_ORIGEM`. */
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

  /**
   * Calcula o frete para o CEP de destino informado.
   *
   * Fluxo:
   * 1. Resolve valores padrão para peso/dimensões opcionais.
   * 2. Verifica cache em memória (TTL de 30 min).
   * 3. Se cache miss → consulta API dos Correios (PAC, timeout 5 s).
   * 4. Parseia o XML de resposta e armazena no cache.
   *
   * @throws {ServiceUnavailableException} se a API dos Correios falhar,
   *   estourar timeout, ou retornar resposta inválida. O controller (ou um
   *   futuro fallback, Issue #77) deve capturar essa exceção.
   */
  async calculate(dto: CalculateShippingDto): Promise<IShippingQuote> {
    const peso = dto.peso ?? DEFAULTS.peso;
    const comprimento = dto.dimensoes?.comprimento ?? DEFAULTS.comprimento;
    const largura = dto.dimensoes?.largura ?? DEFAULTS.largura;
    const altura = dto.dimensoes?.altura ?? DEFAULTS.altura;

    const cacheKey = this.buildCacheKey(
      dto.cep_destino,
      peso,
      comprimento,
      largura,
      altura,
    );

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit para CEP ${dto.cep_destino}`);
      return cached;
    }

    this.logger.log(
      `Consultando Correios: ${this.cepOrigem} → ${dto.cep_destino}`,
    );

    const quote = await this.fetchFromCorreios(
      dto.cep_destino,
      peso,
      comprimento,
      largura,
      altura,
    );

    this.setInCache(cacheKey, quote);
    return quote;
  }

  // ─── Correios API ────────────────────────────────────────────────────

  /**
   * Chama o endpoint CalcPrecoPrazo dos Correios via GET.
   * Usa formato caixa (nCdFormato = 1), sem mão-própria, sem aviso de
   * recebimento e sem valor declarado.
   */
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
            nCdServico: SERVICO_PAC,
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

  /**
   * Parseia a resposta XML do CalcPrecoPrazo.
   *
   * Estrutura esperada (campos relevantes):
   * ```xml
   * <Servicos>
   *   <cServico>
   *     <Valor>25,80</Valor>
   *     <PrazoEntrega>5</PrazoEntrega>
   *     <Erro>0</Erro>
   *     <MsgErro></MsgErro>
   *   </cServico>
   * </Servicos>
   * ```
   *
   * Usa regex simples — a estrutura da resposta é estável e previsível,
   * dispensando um parser XML completo (sem dependência adicional).
   */
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
      throw new ServiceUnavailableException(
        'Resposta inesperada do serviço dos Correios',
      );
    }

    // Correios usa vírgula como separador decimal ("25,80" → 25.80)
    const valor = parseFloat(valorStr.replace(',', '.'));
    const prazo_dias = parseInt(prazoStr, 10);

    if (isNaN(valor) || isNaN(prazo_dias)) {
      this.logger.error(
        `Valores inválidos na resposta: valor="${valorStr}", prazo="${prazoStr}"`,
      );
      throw new ServiceUnavailableException(
        'Resposta inesperada do serviço dos Correios',
      );
    }

    return { valor, prazo_dias };
  }

  /** Extrai o conteúdo de uma tag XML simples (sem atributos nem aninhamento). */
  private extractXmlTag(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match?.[1]?.trim() || null;
  }

  /**
   * Converte erros de rede/timeout do Axios em ServiceUnavailableException
   * com log adequado para cada cenário.
   */
  private handleCorreiosError(error: unknown): never {
    const axiosError = error as AxiosError;

    if (
      axiosError.code === 'ECONNABORTED' ||
      axiosError.code === 'ETIMEDOUT'
    ) {
      this.logger.error(
        `Timeout ao consultar Correios (limite: ${CORREIOS_TIMEOUT_MS}ms)`,
      );
      throw new ServiceUnavailableException(
        'Serviço dos Correios indisponível (timeout)',
      );
    }

    this.logger.error(
      `Erro ao consultar Correios: ${axiosError.message}`,
      axiosError.stack,
    );
    throw new ServiceUnavailableException(
      'Serviço dos Correios indisponível',
    );
  }

  // ─── Cache em memória ────────────────────────────────────────────────

  /** Monta chave composta: `cep:peso:comp:larg:alt`. */
  private buildCacheKey(
    cep: string,
    peso: number,
    comprimento: number,
    largura: number,
    altura: number,
  ): string {
    return `${cep}:${peso}:${comprimento}:${largura}:${altura}`;
  }

  /** Retorna entrada do cache se válida (dentro do TTL), ou `null`. */
  private getFromCache(key: string): IShippingQuote | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /** Armazena no cache com TTL. Dispara eviction se o limite foi atingido. */
  private setInCache(key: string, data: IShippingQuote): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      this.evictExpired();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /** Remove todas as entradas expiradas do cache. */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
