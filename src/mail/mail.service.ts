import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { firstValueFrom } from 'rxjs';

import {
  GMAIL_API_SEND_URL,
  GMAIL_TOKEN_REFRESH_BUFFER_MS,
  GOOGLE_OAUTH_TOKEN_URL,
  MAIL_DEFAULT_SENDER_NAME,
  MS_PER_SECOND,
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_DEFAULT_PORT,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_IMPLICIT_TLS_PORT,
  SMTP_SOCKET_TIMEOUT_MS,
} from '../common/constants';

import type { MailMessage, MailTransportMode } from './interfaces/mail-message.interface';
import type { Transporter } from 'nodemailer';

interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

/**
 * Envio de e-mail transacional (issue #247).
 *
 * Dois transportes, escolhidos por `MAIL_TRANSPORT` (ou detectados pelas variáveis
 * presentes):
 * - `smtp`: SMTP comum — no Gmail, `smtp.gmail.com` com senha de app.
 * - `gmail-api`: a mesma conta Gmail, mas via HTTPS (OAuth2 + Gmail API). Existe
 *   porque o plano gratuito do Render bloqueia as portas SMTP de saída (25/465/587).
 *
 * Sem configuração, o serviço fica desabilitado: `send` lança 503 e o restante da
 * aplicação sobe normalmente (mesmo padrão das demais integrações opcionais).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly mode: MailTransportMode;
  private readonly from?: string;
  private readonly smtp?: Transporter;
  private readonly gmail?: GmailCredentials;
  // Monta a mensagem MIME sem enviar; usada pelo transporte gmail-api.
  private readonly composer = createTransport({ streamTransport: true, buffer: true });
  private gmailToken: CachedToken | null = null;

  constructor(private readonly httpService: HttpService) {
    const env = process.env;
    const { requested, mode } = resolveMode(env);
    this.mode = mode;

    if (mode === 'smtp') {
      this.smtp = this.buildSmtpTransport();
    } else if (mode === 'gmail-api') {
      this.gmail = {
        clientId: env.GMAIL_CLIENT_ID!,
        clientSecret: env.GMAIL_CLIENT_SECRET!,
        refreshToken: env.GMAIL_REFRESH_TOKEN!,
      };
    }

    this.from = env.MAIL_FROM || this.defaultFrom();
    this.logMode(requested);
  }

  /** Se há um transporte configurado; sem ele, `send` sempre falha com 503. */
  isEnabled(): boolean {
    return this.mode !== 'disabled';
  }

  getMode(): MailTransportMode {
    return this.mode;
  }

  /**
   * Envia um e-mail. Falhas do provedor viram 503 com mensagem genérica; o
   * detalhe (sem credenciais) vai só para o log.
   */
  async send(message: MailMessage): Promise<void> {
    if (this.mode === 'disabled') {
      throw new ServiceUnavailableException(
        'Envio de e-mail não configurado. Defina as variáveis SMTP_* (ou GMAIL_*) no servidor.',
      );
    }

    try {
      if (this.mode === 'smtp') {
        await this.smtp!.sendMail({ ...message, from: this.from });
      } else {
        await this.sendViaGmailApi(message);
      }
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail via ${this.mode}: ${describeError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Não foi possível enviar o e-mail agora. Tente novamente em instantes.',
      );
    }
  }

  private buildSmtpTransport(): Transporter {
    const port = Number(process.env.SMTP_PORT ?? SMTP_DEFAULT_PORT);
    const secure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === 'true'
        : port === SMTP_IMPLICIT_TLS_PORT;

    return createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        // O Gmail exibe a senha de app em blocos ("abcd efgh ijkl mnop"); os espaços não fazem parte dela.
        pass: process.env.SMTP_PASS!.replace(/\s+/g, ''),
      },
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    });
  }

  /** Remetente padrão: a própria conta SMTP com o nome da loja. */
  private defaultFrom(): string | undefined {
    const user = process.env.SMTP_USER;
    // No gmail-api, sem MAIL_FROM o Gmail preenche o remetente com a conta autenticada.
    return this.mode === 'smtp' && user ? `"${MAIL_DEFAULT_SENDER_NAME}" <${user}>` : undefined;
  }

  private logMode(requested: string): void {
    if (this.mode !== 'disabled') {
      this.logger.log(`Envio de e-mail habilitado (transporte: ${this.mode}).`);
      return;
    }
    const reason = requested
      ? `MAIL_TRANSPORT=${requested}, mas faltam as credenciais desse transporte`
      : 'nenhuma credencial SMTP_* ou GMAIL_* definida';
    this.logger.warn(`Envio de e-mail desabilitado (${reason}).`);
  }

  private async sendViaGmailApi(message: MailMessage): Promise<void> {
    const composed = await this.composer.sendMail({ ...message, from: this.from });
    const raw = (composed.message as Buffer).toString('base64url');
    const token = await this.getGmailAccessToken();

    await firstValueFrom(
      this.httpService.post(
        GMAIL_API_SEND_URL,
        { raw },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
  }

  /** access_token do Gmail a partir do refresh_token, reaproveitado até perto de expirar. */
  private async getGmailAccessToken(): Promise<string> {
    if (this.gmailToken && this.gmailToken.expiresAt - GMAIL_TOKEN_REFRESH_BUFFER_MS > Date.now()) {
      return this.gmailToken.value;
    }

    const body = new URLSearchParams({
      client_id: this.gmail!.clientId,
      client_secret: this.gmail!.clientSecret,
      refresh_token: this.gmail!.refreshToken,
      grant_type: 'refresh_token',
    });
    const response = await firstValueFrom(
      this.httpService.post<{ access_token: string; expires_in: number }>(
        GOOGLE_OAUTH_TOKEN_URL,
        body.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    );

    this.gmailToken = {
      value: response.data.access_token,
      expiresAt: Date.now() + response.data.expires_in * MS_PER_SECOND,
    };
    return this.gmailToken.value;
  }
}

/**
 * Transporte efetivo: o pedido em MAIL_TRANSPORT ou, sem ele, o primeiro cujas
 * credenciais estejam completas. Pedido sem credenciais = desabilitado.
 */
function resolveMode(env: NodeJS.ProcessEnv): { requested: string; mode: MailTransportMode } {
  const ready = new Map<MailTransportMode, boolean>([
    ['smtp', Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)],
    [
      'gmail-api',
      Boolean(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN),
    ],
  ]);
  const detected = [...ready.keys()].find((mode) => ready.get(mode)) ?? '';
  const requested = env.MAIL_TRANSPORT ?? detected;
  const mode = requested as MailTransportMode;

  return { requested, mode: ready.get(mode) ? mode : 'disabled' };
}

/** Resumo do erro para o log, sem corpo de requisição (que pode conter credenciais). */
function describeError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const { response, code, message } = error as {
      response?: { status?: number; data?: { error?: unknown } };
      code?: string;
      message?: string;
    };
    if (response?.status) {
      return `HTTP ${response.status} ${JSON.stringify(response.data?.error ?? '')}`;
    }
    return [code, message].filter(Boolean).join(' ') || 'erro desconhecido';
  }
  return String(error);
}
