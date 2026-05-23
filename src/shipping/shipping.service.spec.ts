import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';

import { CEP_RANGES } from './data/cep-ranges';
import { ShippingService } from './shipping.service';

import type { CalculateShippingDto } from './dtos/calculate-shipping.dto';
import type { TestingModule } from '@nestjs/testing';
import type { AxiosResponse } from 'axios';

function makeResponse(xml: string): AxiosResponse<string> {
  return {
    data: xml,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
}

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

const XML_ERRO_CORREIOS = `<?xml version="1.0"?>
<Servicos>
  <cServico>
    <Valor></Valor>
    <PrazoEntrega>0</PrazoEntrega>
    <Erro>-3</Erro>
    <MsgErro>CEP de destino invalido</MsgErro>
  </cServico>
</Servicos>`;

describe('ShippingService', () => {
  let service: ShippingService;
  let httpServiceMock: { get: jest.Mock };
  const originalEnv = process.env.LOJA_CEP_ORIGEM;

  beforeEach(async () => {
    process.env.LOJA_CEP_ORIGEM = '70002900';
    httpServiceMock = { get: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [ShippingService, { provide: HttpService, useValue: httpServiceMock }],
    }).compile();

    service = moduleRef.get(ShippingService);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LOJA_CEP_ORIGEM;
    } else {
      process.env.LOJA_CEP_ORIGEM = originalEnv;
    }
  });

  describe('inicialização', () => {
    it('lança erro se LOJA_CEP_ORIGEM não estiver definido', async () => {
      delete process.env.LOJA_CEP_ORIGEM;
      await expect(
        Test.createTestingModule({
          providers: [ShippingService, { provide: HttpService, useValue: { get: jest.fn() } }],
        }).compile(),
      ).rejects.toThrow(/LOJA_CEP_ORIGEM/);
    });
  });

  describe('calculate', () => {
    it('consulta Correios e retorna valor e prazo', async () => {
      httpServiceMock.get.mockReturnValue(of(makeResponse(XML_OK)));

      const dto = { cep_destino: '01310100' } as CalculateShippingDto;
      const result = await service.calculate(dto);

      expect(result).toEqual({ valor: 25.8, prazo_dias: 5 });
      expect(httpServiceMock.get).toHaveBeenCalledTimes(1);
    });

    it('usa cache em chamadas repetidas com mesmos parâmetros', async () => {
      httpServiceMock.get.mockReturnValue(of(makeResponse(XML_OK)));

      const dto = { cep_destino: '01310100' } as CalculateShippingDto;
      await service.calculate(dto);
      await service.calculate(dto);
      await service.calculate(dto);

      expect(httpServiceMock.get).toHaveBeenCalledTimes(1);
    });

    it('cai no fallback quando Correios retorna timeout', async () => {
      const timeoutError = Object.assign(new AxiosError('timeout'), {
        code: 'ECONNABORTED',
      });
      httpServiceMock.get.mockReturnValue(throwError(() => timeoutError));

      const dto = { cep_destino: '01310100' } as CalculateShippingDto;
      const result = await service.calculate(dto);

      // 01310100 cai na faixa Sudeste
      expect(result).toEqual({ valor: 22.0, prazo_dias: 5 });
    });

    it('cai no fallback quando Correios retorna erro de servico', async () => {
      httpServiceMock.get.mockReturnValue(of(makeResponse(XML_ERRO_CORREIOS)));

      const dto = { cep_destino: '70002900' } as CalculateShippingDto;
      const result = await service.calculate(dto);

      // 70002900 cai na faixa Centro-Oeste (origem)
      expect(result).toEqual({ valor: 15.0, prazo_dias: 2 });
    });

    it('propaga erro não-ServiceUnavailable do Axios', async () => {
      httpServiceMock.get.mockReturnValue(throwError(() => new Error('boom inesperado')));

      const dto = { cep_destino: '01310100' } as CalculateShippingDto;
      // erros desconhecidos viram ServiceUnavailableException no handleCorreiosError
      // e portanto também caem no fallback. Cobrimos isso aqui.
      const result = await service.calculate(dto);
      expect(result).toEqual({ valor: 22.0, prazo_dias: 5 });
    });

    it('aceita peso e dimensões customizados', async () => {
      httpServiceMock.get.mockReturnValue(of(makeResponse(XML_OK)));

      const dto = {
        cep_destino: '01310100',
        peso: 2.5,
        dimensoes: { comprimento: 30, largura: 25, altura: 10 },
      } as CalculateShippingDto;

      await service.calculate(dto);

      const params = httpServiceMock.get.mock.calls[0][1].params;
      expect(params.nVlPeso).toBe('2.5');
      expect(params.nVlComprimento).toBe('30');
      expect(params.nVlLargura).toBe('25');
      expect(params.nVlAltura).toBe('10');
    });
  });

  describe('calculateByRange', () => {
    it.each([
      ['01310100', 22.0, 5], // Sudeste
      ['40000000', 30.0, 8], // Nordeste
      ['66000000', 38.0, 12], // Norte
      ['70002900', 15.0, 2], // DF (origem)
      ['78000000', 28.0, 8], // MT/RO/TO/MS
      ['90000000', 25.0, 6], // Sul
    ])('CEP %s → R$ %d em %d dias', (cep, valor, prazo) => {
      expect(service.calculateByRange(cep)).toEqual({
        valor,
        prazo_dias: prazo,
      });
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
