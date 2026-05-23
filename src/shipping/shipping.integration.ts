import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { AxiosError } from 'axios';
import { ZodValidationPipe } from 'nestjs-zod';
import { of, throwError } from 'rxjs';
import request from 'supertest';

import { ShippingModule } from './shipping.module';

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { AxiosResponse } from 'axios';

const INTEGRATION_TEST_TIMEOUT_MS = 30_000;

const XML_OK = `<?xml version="1.0"?>
<Servicos>
  <cServico>
    <Codigo>04510</Codigo>
    <Valor>25,80</Valor>
    <PrazoEntrega>5</PrazoEntrega>
    <Erro>0</Erro>
    <MsgErro></MsgErro>
  </cServico>
</Servicos>`;

function makeResponse(xml: string): AxiosResponse<string> {
  return {
    data: xml,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
}

describe('ShippingModule integration', () => {
  jest.setTimeout(INTEGRATION_TEST_TIMEOUT_MS);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let httpServiceMock: { get: jest.Mock };
  const originalEnv = process.env.LOJA_CEP_ORIGEM;

  beforeAll(async () => {
    process.env.LOJA_CEP_ORIGEM = '70002900';
    httpServiceMock = { get: jest.fn() };

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
    if (app) {
      await app.close();
    }
    if (originalEnv === undefined) {
      delete process.env.LOJA_CEP_ORIGEM;
    } else {
      process.env.LOJA_CEP_ORIGEM = originalEnv;
    }
  });

  beforeEach(() => {
    httpServiceMock.get.mockReset();
  });

  it('POST /api/shipping/calculate retorna valor e prazo (Correios OK)', async () => {
    httpServiceMock.get.mockReturnValue(of(makeResponse(XML_OK)));

    const res = await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '01310100' })
      .expect(200);

    expect(res.body).toEqual({ valor: 25.8, prazo_dias: 5 });
  });

  it('aceita CEP com máscara XXXXX-XXX', async () => {
    httpServiceMock.get.mockReturnValue(of(makeResponse(XML_OK)));

    // CEP único para este teste (evita reusar entrada do cache)
    const res = await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '20040-020' })
      .expect(200);

    expect(res.body.valor).toBe(25.8);
    expect(httpServiceMock.get).toHaveBeenCalled();
    expect(httpServiceMock.get.mock.calls[0][1].params.sCepDestino).toBe('20040020');
  });

  it('cai no fallback quando Correios dá timeout (não retorna 503)', async () => {
    const timeoutError = Object.assign(new AxiosError('timeout'), {
      code: 'ECONNABORTED',
    });
    httpServiceMock.get.mockReturnValue(throwError(() => timeoutError));

    const res = await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '90010000' })
      .expect(200);

    // 90010000 cai na faixa Sul
    expect(res.body).toEqual({ valor: 25.0, prazo_dias: 6 });
  });

  it('rejeita CEP malformado com 400', async () => {
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

  it('aceita peso e dimensões opcionais e propaga aos Correios', async () => {
    httpServiceMock.get.mockReturnValue(of(makeResponse(XML_OK)));

    await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({
        cep_destino: '01310100',
        peso: 1.5,
        dimensoes: { comprimento: 25, largura: 20, altura: 5 },
      })
      .expect(200);

    const params = httpServiceMock.get.mock.calls[0][1].params;
    expect(params.nVlPeso).toBe('1.5');
    expect(params.nVlComprimento).toBe('25');
    expect(params.nVlLargura).toBe('20');
    expect(params.nVlAltura).toBe('5');
  });

  it('endpoint é público (não exige auth header)', async () => {
    httpServiceMock.get.mockReturnValue(of(makeResponse(XML_OK)));

    await request(app.getHttpServer())
      .post('/api/shipping/calculate')
      .send({ cep_destino: '70002900' })
      .expect(200);
  });
});
