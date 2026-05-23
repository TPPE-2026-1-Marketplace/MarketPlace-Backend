import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';

import { MelhorEnvioTokenManager } from './melhor-envio-token-manager';

import type { TestingModule } from '@nestjs/testing';
import type { AxiosResponse } from 'axios';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

function makeTokenResponse(data: Record<string, unknown>): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
}

describe('MelhorEnvioTokenManager', () => {
  let httpServiceMock: { post: jest.Mock };
  const ENV_KEYS = [
    'MELHOR_ENVIO_BASE_URL',
    'MELHOR_ENVIO_USER_AGENT',
    'MELHOR_ENVIO_CLIENT_ID',
    'MELHOR_ENVIO_CLIENT_SECRET',
    'MELHOR_ENVIO_REFRESH_TOKEN',
    'MELHOR_ENVIO_ACCESS_TOKEN',
  ];
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    process.env.MELHOR_ENVIO_BASE_URL = 'https://sandbox.melhorenvio.com.br';
    process.env.MELHOR_ENVIO_USER_AGENT = 'Test (test@local)';
    httpServiceMock = { post: jest.fn() };
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  async function build(): Promise<MelhorEnvioTokenManager> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [MelhorEnvioTokenManager, { provide: HttpService, useValue: httpServiceMock }],
    }).compile();
    return moduleRef.get(MelhorEnvioTokenManager);
  }

  describe('configuração', () => {
    it('lança erro se BASE_URL não definido', async () => {
      delete process.env.MELHOR_ENVIO_BASE_URL;
      await expect(build()).rejects.toThrow(/MELHOR_ENVIO_BASE_URL/);
    });

    it('lança erro se USER_AGENT não definido', async () => {
      delete process.env.MELHOR_ENVIO_USER_AGENT;
      await expect(build()).rejects.toThrow(/MELHOR_ENVIO_USER_AGENT/);
    });

    it('lança erro se faltar OAuth2 e ACCESS_TOKEN estático', async () => {
      await expect(build()).rejects.toThrow(/Configuração da Melhor Envio incompleta/);
    });
  });

  describe('modo estático', () => {
    it('retorna o ACCESS_TOKEN sem chamar a API', async () => {
      process.env.MELHOR_ENVIO_ACCESS_TOKEN = 'static-token-abc';
      const manager = await build();

      const token = await manager.getValidAccessToken();

      expect(token).toBe('static-token-abc');
      expect(httpServiceMock.post).not.toHaveBeenCalled();
    });

    it('retorna sempre o mesmo token em chamadas repetidas (sem refresh)', async () => {
      process.env.MELHOR_ENVIO_ACCESS_TOKEN = 'static-token-xyz';
      const manager = await build();

      const t1 = await manager.getValidAccessToken();
      const t2 = await manager.getValidAccessToken();

      expect(t1).toBe(t2);
      expect(httpServiceMock.post).not.toHaveBeenCalled();
    });
  });

  describe('modo OAuth2', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1h no futuro

    beforeEach(() => {
      process.env.MELHOR_ENVIO_CLIENT_ID = '9537';
      process.env.MELHOR_ENVIO_CLIENT_SECRET = 'secret-abc';
      process.env.MELHOR_ENVIO_REFRESH_TOKEN = 'refresh-token-original';
    });

    it('usa o ACCESS_TOKEN estático como seed inicial (sem refresh) se ainda válido', async () => {
      const seedToken = makeJwt({ exp: futureExp });
      process.env.MELHOR_ENVIO_ACCESS_TOKEN = seedToken;

      const manager = await build();
      const token = await manager.getValidAccessToken();

      expect(token).toBe(seedToken);
      expect(httpServiceMock.post).not.toHaveBeenCalled();
    });

    it('chama /oauth/token com refresh_token grant quando não tem seed', async () => {
      const newAccessToken = makeJwt({ exp: futureExp });
      httpServiceMock.post.mockReturnValue(
        of(
          makeTokenResponse({
            token_type: 'Bearer',
            expires_in: 2592000,
            access_token: newAccessToken,
            refresh_token: 'refresh-token-original',
          }),
        ),
      );

      const manager = await build();
      const token = await manager.getValidAccessToken();

      expect(token).toBe(newAccessToken);
      expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
      const [url, body, options] = httpServiceMock.post.mock.calls[0];
      expect(url).toBe('https://sandbox.melhorenvio.com.br/oauth/token');
      expect(body).toEqual({
        grant_type: 'refresh_token',
        refresh_token: 'refresh-token-original',
        client_id: '9537',
        client_secret: 'secret-abc',
      });
      expect(options.headers['User-Agent']).toBe('Test (test@local)');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('renova preemptivamente quando o token atual está perto de expirar', async () => {
      // seed token expira em 2 minutos (dentro do buffer de 5min)
      const nearExp = Math.floor(Date.now() / 1000) + 120;
      process.env.MELHOR_ENVIO_ACCESS_TOKEN = makeJwt({ exp: nearExp });

      const renewedToken = makeJwt({ exp: futureExp });
      httpServiceMock.post.mockReturnValue(
        of(
          makeTokenResponse({
            token_type: 'Bearer',
            expires_in: 2592000,
            access_token: renewedToken,
            refresh_token: 'refresh-token-original',
          }),
        ),
      );

      const manager = await build();
      const token = await manager.getValidAccessToken();

      expect(token).toBe(renewedToken);
      expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
    });

    it('reusa o token cacheado em chamadas dentro da janela de validade', async () => {
      const seedToken = makeJwt({ exp: futureExp });
      process.env.MELHOR_ENVIO_ACCESS_TOKEN = seedToken;

      const manager = await build();
      const t1 = await manager.getValidAccessToken();
      const t2 = await manager.getValidAccessToken();
      const t3 = await manager.getValidAccessToken();

      expect(t1).toBe(t2);
      expect(t2).toBe(t3);
      expect(httpServiceMock.post).not.toHaveBeenCalled();
    });

    it('invalidate() força refresh na próxima chamada', async () => {
      const seedToken = makeJwt({ exp: futureExp });
      process.env.MELHOR_ENVIO_ACCESS_TOKEN = seedToken;

      const renewedToken = makeJwt({ exp: futureExp + 1000 });
      httpServiceMock.post.mockReturnValue(
        of(
          makeTokenResponse({
            token_type: 'Bearer',
            expires_in: 2592000,
            access_token: renewedToken,
          }),
        ),
      );

      const manager = await build();
      await manager.getValidAccessToken();
      manager.invalidate();
      const after = await manager.getValidAccessToken();

      expect(after).toBe(renewedToken);
      expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
    });

    it('loga warn quando refresh_token rotaciona', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const newAccessToken = makeJwt({ exp: futureExp });
        httpServiceMock.post.mockReturnValue(
          of(
            makeTokenResponse({
              token_type: 'Bearer',
              expires_in: 2592000,
              access_token: newAccessToken,
              refresh_token: 'refresh-token-NOVO-rotacionado',
            }),
          ),
        );

        const manager = await build();
        await manager.getValidAccessToken();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rotacionou'));
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('decode JWT', () => {
    it('cai pro expires_in quando o JWT não tem exp parseável', async () => {
      process.env.MELHOR_ENVIO_CLIENT_ID = '9537';
      process.env.MELHOR_ENVIO_CLIENT_SECRET = 'secret';
      process.env.MELHOR_ENVIO_REFRESH_TOKEN = 'refresh';

      httpServiceMock.post.mockReturnValue(
        of(
          makeTokenResponse({
            token_type: 'Bearer',
            expires_in: 3600, // 1h: maior que o buffer de 5min
            access_token: 'malformed-not-a-jwt',
          }),
        ),
      );

      const manager = await build();
      const token = await manager.getValidAccessToken();

      expect(token).toBe('malformed-not-a-jwt');
      // segunda chamada imediata: usa cache (ainda dentro de 1h - 5min)
      const again = await manager.getValidAccessToken();
      expect(again).toBe(token);
      expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
    });
  });
});
