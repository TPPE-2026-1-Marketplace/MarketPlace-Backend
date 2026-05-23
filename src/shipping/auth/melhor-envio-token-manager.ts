import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import {
  MELHOR_ENVIO_TIMEOUT_MS,
  MELHOR_ENVIO_TOKEN_PATH,
  MELHOR_ENVIO_TOKEN_REFRESH_BUFFER_MS,
} from '../../common/constants';
import { IMelhorEnvioTokenResponse } from '../interfaces/melhor-envio.interface';

interface CachedToken {
  accessToken: string;
  expiresAt: number; // ms epoch
}

type AuthMode = 'oauth2' | 'static';

/**
 * Gerencia o access_token usado nas chamadas à API Melhor Envio.
 *
 * Modo principal (OAuth2): se `MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET`
 * e `MELHOR_ENVIO_REFRESH_TOKEN` estiverem definidos, faz refresh_token grant
 * preemptivamente — decodifica o JWT atual e renova quando faltam menos que
 * `MELHOR_ENVIO_TOKEN_REFRESH_BUFFER_MS` para expirar (default 5 min).
 *
 * Modo fallback (estático): se faltar qualquer das envs OAuth2, usa
 * `MELHOR_ENVIO_ACCESS_TOKEN` direto, sem renovar. Útil pra debug local
 * sem precisar do fluxo OAuth completo. Quando o token expirar, requests
 * vão começar a tomar 401 e a aplicação cai no fallback de faixas de CEP.
 *
 * Em ambos os modos, o token validado é cacheado em memória até a próxima
 * janela de renovação (ou indefinidamente em modo estático).
 */
@Injectable()
export class MelhorEnvioTokenManager {
  private readonly logger = new Logger(MelhorEnvioTokenManager.name);
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly mode: AuthMode;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly refreshToken?: string;
  private readonly staticToken?: string;
  private cached: CachedToken | null = null;

  constructor(private readonly httpService: HttpService) {
    const baseUrl = process.env.MELHOR_ENVIO_BASE_URL;
    const userAgent = process.env.MELHOR_ENVIO_USER_AGENT;
    if (!baseUrl) {
      throw new Error('Variável de ambiente MELHOR_ENVIO_BASE_URL não está definida.');
    }
    if (!userAgent) {
      throw new Error('Variável de ambiente MELHOR_ENVIO_USER_AGENT não está definida.');
    }
    this.baseUrl = baseUrl;
    this.userAgent = userAgent;

    const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;
    const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET;
    const refreshToken = process.env.MELHOR_ENVIO_REFRESH_TOKEN;
    const staticToken = process.env.MELHOR_ENVIO_ACCESS_TOKEN;

    if (clientId && clientSecret && refreshToken) {
      this.mode = 'oauth2';
      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.refreshToken = refreshToken;
      this.staticToken = staticToken;
      this.logger.log('Melhor Envio em modo OAuth2 (refresh preemptivo).');
      if (staticToken) {
        this.seedFromStaticToken(staticToken);
      }
    } else if (staticToken) {
      this.mode = 'static';
      this.staticToken = staticToken;
      this.seedFromStaticToken(staticToken);
      this.logger.warn(
        'Melhor Envio em modo estático: sem renovação automática. ' +
          'Defina CLIENT_ID/SECRET/REFRESH_TOKEN para habilitar OAuth2.',
      );
    } else {
      throw new Error(
        'Configuração da Melhor Envio incompleta. Defina ou o trio ' +
          'OAuth2 (MELHOR_ENVIO_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN) ou o ' +
          'fallback estático (MELHOR_ENVIO_ACCESS_TOKEN).',
      );
    }
  }

  /**
   * Retorna um access_token válido. Em modo OAuth2, renova preemptivamente
   * se o atual estiver próximo de expirar. Em modo estático, retorna sempre
   * o mesmo token (sem checagem de expiração).
   */
  async getValidAccessToken(): Promise<string> {
    if (this.mode === 'static') {
      return this.staticToken as string;
    }

    if (this.cached && !this.needsRefresh(this.cached)) {
      return this.cached.accessToken;
    }

    return this.refreshAccessToken();
  }

  /**
   * Limpa o cache em memória. Útil quando uma chamada HTTP retornar 401
   * mesmo com token "válido" (relógio desincronizado, token revogado, etc.).
   */
  invalidate(): void {
    this.cached = null;
  }

  private needsRefresh(token: CachedToken): boolean {
    return Date.now() + MELHOR_ENVIO_TOKEN_REFRESH_BUFFER_MS >= token.expiresAt;
  }

  private async refreshAccessToken(): Promise<string> {
    this.logger.log('Renovando access_token via refresh_token grant.');

    const response = await firstValueFrom(
      this.httpService.post<IMelhorEnvioTokenResponse>(
        `${this.baseUrl}${MELHOR_ENVIO_TOKEN_PATH}`,
        {
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
          },
          timeout: MELHOR_ENVIO_TIMEOUT_MS,
        },
      ),
    );

    const { access_token, expires_in, refresh_token: newRefresh } = response.data;
    const expiresAt = this.computeExpiresAt(access_token, expires_in);
    this.cached = { accessToken: access_token, expiresAt };

    if (newRefresh && newRefresh !== this.refreshToken) {
      this.logger.warn(
        'Melhor Envio rotacionou o refresh_token. Atualize MELHOR_ENVIO_REFRESH_TOKEN ' +
          'no .env.development senão a próxima renovação após restart vai falhar.',
      );
    }

    return access_token;
  }

  /**
   * Calcula o timestamp absoluto de expiração. Prefere o `exp` do JWT
   * (mais preciso, é o que o servidor honra); se decode falhar, cai em
   * `Date.now() + expires_in * 1000`.
   */
  private computeExpiresAt(jwt: string, expiresInSeconds: number): number {
    const SECONDS_TO_MS = 1000;
    const decodedExp = this.decodeJwtExp(jwt);
    if (decodedExp !== null) {
      return decodedExp * SECONDS_TO_MS;
    }
    return Date.now() + expiresInSeconds * SECONDS_TO_MS;
  }

  /**
   * Decodifica o payload de um JWT sem verificar assinatura (só pra ler `exp`).
   * Retorna `null` se o token não estiver no formato esperado.
   */
  private decodeJwtExp(jwt: string): number | null {
    const JWT_PARTS = 3;
    const PAYLOAD_INDEX = 1;
    const parts = jwt.split('.');
    if (parts.length !== JWT_PARTS) return null;
    try {
      const base64 = parts[PAYLOAD_INDEX].replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(base64, 'base64').toString('utf8');
      const payload = JSON.parse(json) as { exp?: number };
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  private seedFromStaticToken(token: string): void {
    const SECONDS_TO_MS = 1000;
    const exp = this.decodeJwtExp(token);
    const expiresAt = exp !== null ? exp * SECONDS_TO_MS : Number.POSITIVE_INFINITY;
    this.cached = { accessToken: token, expiresAt };
  }
}
