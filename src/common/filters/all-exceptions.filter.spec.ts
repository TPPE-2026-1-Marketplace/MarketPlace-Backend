import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { AllExceptionsFilter } from './all-exceptions.filter';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

import type { ArgumentsHost } from '@nestjs/common';

function buildHost(options: { requestId?: string; method?: string; url?: string }): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: options.method ?? 'GET',
        url: options.url ?? '/api/test',
        headers: options.requestId ? { [CORRELATION_ID_HEADER]: options.requestId } : {},
      }),
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reformata uma HttpException comum (NotFoundException) no envelope padrão', () => {
    const { host, json, status } = buildHost({
      requestId: 'req-1',
      method: 'GET',
      url: '/api/people/1',
    });

    filter.catch(new NotFoundException('Pessoa não encontrada'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        path: '/api/people/1',
        method: 'GET',
        message: 'Pessoa não encontrada',
        requestId: 'req-1',
      }),
    );
    expect(json.mock.calls[0][0]).not.toHaveProperty('errors');
  });

  it('reformata ForbiddenException mantendo o status 403', () => {
    const { host, json, status } = buildHost({});

    filter.catch(new ForbiddenException('Acesso negado'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Acesso negado' }));
  });

  it('extrai os campos de erro de uma exceção de validação (formato nestjs-zod)', () => {
    const { host, json, status } = buildHost({});
    const validationException = new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors: [{ path: ['email'], message: 'Invalid email format' }],
    });

    filter.catch(validationException, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Invalid email format' }],
      }),
    );
  });

  it('usa "(root)" como nome do campo quando o issue de validação não tem path', () => {
    const { host, json } = buildHost({});
    const validationException = new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors: [{ path: [], message: 'Formato geral inválido' }],
    });

    filter.catch(validationException, host);

    expect(json.mock.calls[0][0].errors).toEqual([
      { field: '(root)', message: 'Formato geral inválido' },
    ]);
  });

  it('mapeia violação de unicidade do banco (QueryFailedError 23505) para 409', () => {
    const { host, json, status } = buildHost({});
    const dbError = Object.assign(new QueryFailedError('INSERT', [], new Error('duplicate')), {
      driverError: { code: '23505' },
    });

    filter.catch(dbError, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: HttpStatus.CONFLICT }));
  });

  it('não trata QueryFailedError de outro código como conflito', () => {
    const { host, status } = buildHost({});
    const dbError = Object.assign(new QueryFailedError('SELECT', [], new Error('timeout')), {
      driverError: { code: '57014' },
    });

    filter.catch(dbError, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('mapeia qualquer erro desconhecido para 500 com mensagem genérica (sem vazar detalhes)', () => {
    const { host, json, status } = buildHost({});

    filter.catch(new Error('stack trace sensível com detalhe interno'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Erro interno do servidor.' }),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('stack trace sensível');
  });

  it('omite requestId do corpo da resposta quando a requisição não tem um', () => {
    const { host, json } = buildHost({});

    filter.catch(new NotFoundException(), host);

    expect(json.mock.calls[0][0]).not.toHaveProperty('requestId');
  });

  it('inclui o path e o method corretos da requisição que falhou', () => {
    const { host, json } = buildHost({ method: 'POST', url: '/api/products' });

    filter.catch(new Error('falha'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/products', method: 'POST' }),
    );
  });
});
