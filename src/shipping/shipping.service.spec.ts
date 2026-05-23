import { HttpService } from '@nestjs/axios';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';

import { MelhorEnvioTokenManager } from './auth/melhor-envio-token-manager';
import { CEP_RANGES } from './data/cep-ranges';
import { ShippingService } from './shipping.service';

import type { CalculateShippingDto } from './dtos/calculate-shipping.dto';
import type { IMelhorEnvioCotacao } from './interfaces/melhor-envio.interface';
import type { TestingModule } from '@nestjs/testing';
import type { AxiosResponse } from 'axios';

function makeResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
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
  {
    id: 3,
    name: '.Package',
    price: '29.05',
    custom_price: '29.05',
    delivery_time: 7,
    custom_delivery_time: 7,
    company: { id: 2, name: 'Jadlog' },
  },
  {
    id: 17,
    name: 'Mini Envios',
    error: 'Dimensões do objeto ultrapassam o limite da transportadora.',
    company: { id: 1, name: 'Correios' },
  },
];

describe('ShippingService', () => {
  let service: ShippingService;
  let httpServiceMock: { post: jest.Mock };
  let tokenManagerMock: { getValidAccessToken: jest.Mock; invalidate: jest.Mock };
  const ENV_KEYS = [
    'LOJA_CEP_ORIGEM',
    'MELHOR_ENVIO_BASE_URL',
    'MELHOR_ENVIO_USER_AGENT',
    'MELHOR_ENVIO_SERVICE_ID',
  ];
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
  });

  afterAll(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  async function build(): Promise<ShippingService> {
    httpServiceMock = { post: jest.fn() };
    tokenManagerMock = {
      getValidAccessToken: jest.fn().mockResolvedValue('test-access-token'),
      invalidate: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: HttpService, useValue: httpServiceMock },
        { provide: MelhorEnvioTokenManager, useValue: tokenManagerMock },
      ],
    }).compile();
    return moduleRef.get(ShippingService);
  }

  beforeEach(() => {
    process.env.LOJA_CEP_ORIGEM = '70002900';
    process.env.MELHOR_ENVIO_BASE_URL = 'https://sandbox.melhorenvio.com.br';
    process.env.MELHOR_ENVIO_USER_AGENT = 'Test (test@local)';
    delete process.env.MELHOR_ENVIO_SERVICE_ID;
  });

  describe('inicialização', () => {
    it('lança erro se LOJA_CEP_ORIGEM não definido', async () => {
      delete process.env.LOJA_CEP_ORIGEM;
      await expect(build()).rejects.toThrow(/LOJA_CEP_ORIGEM/);
    });
  });

  describe('calculate (sem MELHOR_ENVIO_SERVICE_ID = mais barato)', () => {
    beforeEach(async () => {
      service = await build();
    });

    it('retorna a cotação mais barata entre as válidas (PAC 27.49)', async () => {
      httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

      const result = await service.calculate({ cep_destino: '01310100' } as CalculateShippingDto);

      expect(result).toEqual({ valor: 27.49, prazo_dias: 6 });
      expect(tokenManagerMock.getValidAccessToken).toHaveBeenCalled();
    });

    it('envia o body no formato esperado pela Melhor Envio', async () => {
      httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

      await service.calculate({
        cep_destino: '01310100',
        peso: 0.5,
        dimensoes: { comprimento: 25, largura: 20, altura: 5 },
      } as CalculateShippingDto);

      const [url, body, options] = httpServiceMock.post.mock.calls[0];
      expect(url).toBe('https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate');
      expect(body).toEqual({
        from: { postal_code: '70002900' },
        to: { postal_code: '01310100' },
        package: { height: 5, width: 20, length: 25, weight: 0.5 },
      });
      expect(options.headers.Authorization).toBe('Bearer test-access-token');
      expect(options.headers['User-Agent']).toBe('Test (test@local)');
    });

    it('cache hit em chamadas repetidas com mesmos parâmetros', async () => {
      httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));
      const dto = { cep_destino: '01310100' } as CalculateShippingDto;

      await service.calculate(dto);
      await service.calculate(dto);
      await service.calculate(dto);

      expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
    });

    it('ignora cotações com error e usa só as válidas', async () => {
      const onlyMiniEnviosWithError: IMelhorEnvioCotacao[] = [
        COTACOES_OK[1], // SEDEX 50.50
        COTACOES_OK[3], // Mini Envios com error
      ];
      httpServiceMock.post.mockReturnValue(of(makeResponse(onlyMiniEnviosWithError)));

      const result = await service.calculate({ cep_destino: '20040020' } as CalculateShippingDto);

      // pulou Mini Envios (error), pegou SEDEX (única válida)
      expect(result).toEqual({ valor: 50.5, prazo_dias: 2 });
    });

    it('cai no fallback quando todas as cotações têm error', async () => {
      const todasComErro: IMelhorEnvioCotacao[] = [
        { ...COTACOES_OK[3], id: 1, name: 'PAC', error: 'CEP de destino inválido' },
      ];
      httpServiceMock.post.mockReturnValue(of(makeResponse(todasComErro)));

      const result = await service.calculate({ cep_destino: '01310100' } as CalculateShippingDto);

      // 01310100 (Sudeste): fallback R$ 22, 5 dias
      expect(result).toEqual({ valor: 22.0, prazo_dias: 5 });
    });

    it('cai no fallback quando dá timeout', async () => {
      httpServiceMock.post.mockReturnValue(
        throwError(() => Object.assign(new AxiosError('timeout'), { code: 'ECONNABORTED' })),
      );

      const result = await service.calculate({ cep_destino: '01310100' } as CalculateShippingDto);

      expect(result).toEqual({ valor: 22.0, prazo_dias: 5 });
    });

    it('401 invalida o cache do token e cai no fallback', async () => {
      httpServiceMock.post.mockReturnValue(
        throwError(() => makeAxiosError(401, { message: 'Unauthenticated.' })),
      );

      const result = await service.calculate({ cep_destino: '90010000' } as CalculateShippingDto);

      // 90010000 (Sul): R$ 25, 6 dias
      expect(result).toEqual({ valor: 25.0, prazo_dias: 6 });
      expect(tokenManagerMock.invalidate).toHaveBeenCalled();
    });

    it('422 propaga como BadRequestException (não cai no fallback)', async () => {
      httpServiceMock.post.mockReturnValue(
        throwError(() => makeAxiosError(422, { message: 'O CEP de destino é obrigatório.' })),
      );

      await expect(
        service.calculate({ cep_destino: '01310100' } as CalculateShippingDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('prioriza custom_price/custom_delivery_time sobre price/delivery_time', async () => {
      const customizado: IMelhorEnvioCotacao[] = [
        {
          id: 1,
          name: 'PAC',
          price: '27.49',
          custom_price: '15.00', // lojista deu desconto
          delivery_time: 6,
          custom_delivery_time: 4, // e prazo mais rápido
          company: { id: 1, name: 'Correios' },
        },
      ];
      httpServiceMock.post.mockReturnValue(of(makeResponse(customizado)));

      const result = await service.calculate({ cep_destino: '01310100' } as CalculateShippingDto);

      expect(result).toEqual({ valor: 15.0, prazo_dias: 4 });
    });
  });

  describe('calculate (com MELHOR_ENVIO_SERVICE_ID=2 = SEDEX fixo)', () => {
    beforeEach(async () => {
      process.env.MELHOR_ENVIO_SERVICE_ID = '2';
      service = await build();
    });

    it('retorna o serviço pedido (SEDEX 50.50) mesmo havendo mais barato', async () => {
      httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

      const result = await service.calculate({ cep_destino: '01310100' } as CalculateShippingDto);

      expect(result).toEqual({ valor: 50.5, prazo_dias: 2 });
    });

    it('cai no mais barato quando o serviço pedido não está na resposta', async () => {
      const semSedex: IMelhorEnvioCotacao[] = [COTACOES_OK[0], COTACOES_OK[2]];
      httpServiceMock.post.mockReturnValue(of(makeResponse(semSedex)));

      const result = await service.calculate({ cep_destino: '01310100' } as CalculateShippingDto);

      // 27.49 PAC é o mais barato entre PAC e .Package
      expect(result).toEqual({ valor: 27.49, prazo_dias: 6 });
    });

    it('envia services no body quando serviceId está definido', async () => {
      httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));

      await service.calculate({ cep_destino: '01310100' } as CalculateShippingDto);

      const body = httpServiceMock.post.mock.calls[0][1];
      expect(body.services).toBe('2');
    });

    it('cache key inclui serviceId — request com SERVICE_ID=2 não compartilha cache com SERVICE_ID=null', async () => {
      httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));
      await service.calculate({ cep_destino: '01310100' } as CalculateShippingDto);
      expect(httpServiceMock.post).toHaveBeenCalledTimes(1);

      // novo service com SERVICE_ID=null
      delete process.env.MELHOR_ENVIO_SERVICE_ID;
      const service2 = await build();
      httpServiceMock.post.mockReturnValue(of(makeResponse(COTACOES_OK)));
      await service2.calculate({ cep_destino: '01310100' } as CalculateShippingDto);
      // chamou de novo (cache não compartilhou)
      expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateByRange (fallback)', () => {
    beforeEach(async () => {
      service = await build();
    });

    it.each([
      ['01310100', 22.0, 5],
      ['40000000', 30.0, 8],
      ['66000000', 38.0, 12],
      ['70002900', 15.0, 2],
      ['78000000', 28.0, 8],
      ['90000000', 25.0, 6],
    ])('CEP %s → R$ %d em %d dias', (cep, valor, prazo) => {
      expect(service.calculateByRange(cep)).toEqual({ valor, prazo_dias: prazo });
    });

    it('lança 503 quando CEP fica fora de todas as faixas', () => {
      expect(() => service.calculateByRange('00000000')).toThrow(ServiceUnavailableException);
    });
  });

  describe('CEP_RANGES (sanidade dos dados)', () => {
    it('cobre toda faixa entre primeiro start e último end sem buracos', () => {
      const sorted = [...CEP_RANGES].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].start).toBe(sorted[i - 1].end + 1);
      }
    });
  });
});
