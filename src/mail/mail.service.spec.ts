import { ServiceUnavailableException } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { of, throwError } from 'rxjs';

import { MailService } from './mail.service';

import type { HttpService } from '@nestjs/axios';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const MAIL_ENV_KEYS = [
  'MAIL_TRANSPORT',
  'MAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
] as const;

const message = { to: 'cliente@ex.com', subject: 'Assunto', text: 'texto', html: '<p>html</p>' };

describe('MailService', () => {
  const savedEnv = { ...process.env };
  let smtpSendMail: jest.Mock;
  let composerSendMail: jest.Mock;
  let http: { post: jest.Mock };

  beforeEach(() => {
    MAIL_ENV_KEYS.forEach((key) => delete process.env[key]);
    smtpSendMail = jest.fn().mockResolvedValue({});
    composerSendMail = jest.fn().mockResolvedValue({ message: Buffer.from('MIME bruto') });
    // O primeiro createTransport do serviço é o composer (streamTransport); o SMTP vem depois.
    jest
      .mocked(createTransport)
      .mockImplementation(((options: { streamTransport?: boolean }) =>
        options.streamTransport
          ? { sendMail: composerSendMail }
          : { sendMail: smtpSendMail }) as unknown as typeof createTransport);
    http = { post: jest.fn() };
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  const build = () => new MailService(http as unknown as HttpService);

  function useGmailSmtp(overrides: Record<string, string> = {}) {
    Object.assign(process.env, {
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USER: 'loja@gmail.com',
      SMTP_PASS: 'abcd efgh ijkl mnop',
      ...overrides,
    });
  }

  it('fica desabilitado sem credenciais e responde 503 ao enviar', async () => {
    const service = build();
    expect(service.isEnabled()).toBe(false);
    await expect(service.send(message)).rejects.toThrow(ServiceUnavailableException);
  });

  it('fica desabilitado quando MAIL_TRANSPORT pede um transporte sem credenciais', () => {
    useGmailSmtp({ MAIL_TRANSPORT: 'gmail-api' });
    expect(build().getMode()).toBe('disabled');
  });

  describe('smtp', () => {
    it('configura o Gmail com TLS implícito na 465 e senha de app sem espaços', async () => {
      useGmailSmtp();
      const service = build();

      expect(service.getMode()).toBe('smtp');
      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: 'loja@gmail.com', pass: 'abcdefghijklmnop' },
        }),
      );

      await service.send(message);
      expect(smtpSendMail).toHaveBeenCalledWith({
        ...message,
        from: '"DK Fashion" <loja@gmail.com>',
      });
    });

    it('usa STARTTLS na 587 e respeita MAIL_FROM', async () => {
      useGmailSmtp({ SMTP_PORT: '587', MAIL_FROM: 'Loja <outra@gmail.com>' });
      const service = build();

      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 587, secure: false }),
      );
      await service.send(message);
      expect(smtpSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'Loja <outra@gmail.com>' }),
      );
    });

    it('converte falha do servidor em 503 genérico', async () => {
      useGmailSmtp();
      smtpSendMail.mockRejectedValue(
        Object.assign(new Error('Invalid login'), { code: 'EAUTH', response: '535 5.7.8' }),
      );
      const service = build();

      await expect(service.send(message)).rejects.toThrow(
        'Não foi possível enviar o e-mail agora. Tente novamente em instantes.',
      );
    });
  });

  describe('gmail-api', () => {
    beforeEach(() => {
      Object.assign(process.env, {
        GMAIL_CLIENT_ID: 'client-id',
        GMAIL_CLIENT_SECRET: 'client-secret',
        GMAIL_REFRESH_TOKEN: 'refresh-token',
      });
    });

    it('troca o refresh_token por access_token e envia o MIME em base64url', async () => {
      http.post
        .mockReturnValueOnce(of({ data: { access_token: 'token-1', expires_in: 3599 } }))
        .mockReturnValue(of({ data: { id: 'msg-1' } }));
      const service = build();

      expect(service.getMode()).toBe('gmail-api');
      await service.send(message);

      const [tokenUrl, tokenBody] = http.post.mock.calls[0];
      expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
      expect(tokenBody).toContain('grant_type=refresh_token');
      expect(tokenBody).toContain('refresh_token=refresh-token');

      const [sendUrl, sendBody, sendConfig] = http.post.mock.calls[1];
      expect(sendUrl).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
      expect(sendBody).toEqual({ raw: Buffer.from('MIME bruto').toString('base64url') });
      expect(sendConfig.headers.Authorization).toBe('Bearer token-1');
      // Sem MAIL_FROM, o Gmail preenche o remetente com a conta autenticada.
      expect(composerSendMail).toHaveBeenCalledWith({ ...message, from: undefined });
    });

    it('reaproveita o access_token enquanto ele é válido', async () => {
      http.post
        .mockReturnValueOnce(of({ data: { access_token: 'token-1', expires_in: 3599 } }))
        .mockReturnValue(of({ data: {} }));
      const service = build();

      await service.send(message);
      await service.send(message);

      const tokenCalls = http.post.mock.calls.filter(([url]) => String(url).includes('oauth2'));
      expect(tokenCalls).toHaveLength(1);
    });

    it('converte erro HTTP da API em 503', async () => {
      http.post.mockReturnValue(
        throwError(() => ({ response: { status: 400, data: { error: 'invalid_grant' } } })),
      );
      await expect(build().send(message)).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
