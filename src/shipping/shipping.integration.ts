import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { AxiosError } from 'axios';
import { ZodValidationPipe } from 'nestjs-zod';
import { of, throwError } from 'rxjs';
import request from 'supertest';

import { ShippingModule } from './shipping.module';

import type { IMelhorEnvioCotacao } from './interfaces/melhor-envio.interface';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { AxiosResponse } from 'axios';

const INTEGRATION_TEST_TIMEOUT_MS = 30_000;

const COTACOES_OK: IMelhorEnvioCotacao[] = [
  {
    id: 1,
    name: 'PAC',
    price: '27.49',
    custom_price: '27.49',
    delivery_time: 6,
    custom_delivery_time: 6,
    company: { id: 1, name: 'Correios' },
  },
  {
    id: 2,
    name: 'SEDEX',
    price: '50.50',
    custom_price: '50.50',
    delivery_time: 2,
    custom_delivery_time: 2,
    company: { id: 1, name: 'Correios' },
  },
];

function makeResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
}

function makeAxiosError(status: number, body: unknown = {}): AxiosError {
  const err = new AxiosError('HTTP error');
  err.response = {
    status,
    data: body,
    statusText: '',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
  return err;
}

describe('ShippingModule integration', () => {
  jest.setTimeout(INTEGRATION_TEST_TIMEOUT_MS);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let httpServiceMock: { post: jest.Mock };
  const ENV_KEYS = [
    'LOJA_CEP_ORIGEM',
    'MELHOR_ENVIO_BASE_URL',
    'MELHOR_ENVIO_USER_AGENT',
    'MELHOR_ENVIO_ACCESS_TOKEN',
    'MELHOR_ENVIO_CLIENT_ID',
    'MELHOR_ENVIO_CLIENT_SECRET',
    'MELHOR_ENVIO_REFRESH_TOKEN',
    'MELHOR_ENVIO_SERVICE_ID',
  ];
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];

    // Modo estático pra simplificar o setup (sem mockar /oauth/token)
    process.env.LOJA_CEP_ORIGEM = '70002900';
    process.env.MELHOR_ENVIO_BASE_URL = 'https://sandbox.melhorenvio.com.br';
    process.env.MELHOR_ENVIO_USER_AGENT = 'DK Fashion Integration Test (test@local)';
    process.env.MELHOR_ENVIO_ACCESS_TOKEN = 'integration-test-static-token';
    delete process.env.MELHOR_ENVIO_CLIENT_ID;
    delete process.env.MELHOR_ENVIO_CLIENT_SECRET;
    delete process.env.MELHOR_ENVIO_REFRESH_TOKEN;
    delete process.env.MELHOR_ENVIO_SERVICE_ID;

    httpServiceMock = { post: jest.fn() };

    moduleRef = await Test.createTestingModule({
      imports: [ShippingModule],
    })
      .overrideProvider(HttpService)
      .useValue(httpServiceMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  beforeEach(() => {
    httpServiceMock.post.mockReset();
  });

  it('POST /api/shipping/calculate retorna mais barato (PAC 27.49)', async () => {
    httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

    const res = await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '01310100' })
      .expect(200);

    expect(res.body).toEqual({ valor: 27.49, prazo_dias: 6 });
  });

  it('envia headers Bearer e User-Agent obrigatórios', async () => {
    httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

    await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '20040020' })
      .expect(200);

    const [, , options] = httpServiceMock.post.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer integration-test-static-token');
    expect(options.headers['User-Agent']).toBe('DK Fashion Integration Test (test@local)');
    expect(options.headers.Accept).toBe('application/json');
  });

  it('envia body no formato Melhor Envio (from/to/package)', async () => {
    httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

    await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({
        cep_destino: '30130-100',
        peso: 1.2,
        dimensoes: { comprimento: 30, largura: 25, altura: 8 },
      })
      .expect(200);

    const body = httpServiceMock.post.mock.calls[0][1];
    expect(body).toEqual({
      from: { postal_code: '70002900' },
      to: { postal_code: '30130100' }, // mascara removida
      package: { height: 8, width: 25, length: 30, weight: 1.2 },
    });
  });

  it('aceita CEP com máscara XXXXX-XXX', async () => {
    httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

    const res = await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '40000-000' })
      .expect(200);

    expect(res.body.valor).toBe(27.49);
  });

  it('cai no fallback quando dá timeout (não retorna 503)', async () => {
    httpServiceMock.post.mockReturnValue(
      throwError(() => Object.assign(new AxiosError('timeout'), { code: 'ECONNABORTED' })),
    );

    const res = await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '60000000' })
      .expect(200);

    // 60000000 (Nordeste): R$ 30, 8 dias
    expect(res.body).toEqual({ valor: 30.0, prazo_dias: 8 });
  });

  it('422 da Melhor Envio propaga como 400', async () => {
    httpServiceMock.post.mockReturnValue(
      throwError(() => makeAxiosError(422, { message: 'O CEP de destino é obrigatório.' })),
    );

    await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '78000000' })
      .expect(400);
  });

  it('rejeita CEP malformado com 400 (validação Zod)', async () => {
    await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '123' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: 'abcdefgh' })
      .expect(400);
  });

  it('rejeita request sem cep_destino', async () => {
    await request(app.getHttpServer()).post('/api/shipping/calculate').send({}).expect(400);
  });

  it('endpoint é público (sem auth header funciona)', async () => {
    httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

    await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '70002900' })
      .expect(200);
  });
});
