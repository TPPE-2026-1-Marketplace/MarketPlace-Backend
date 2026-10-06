import { CORRELATION_ID_HEADER, correlationIdMiddleware } from './correlation-id.middleware';

import type { NextFunction, Request, Response } from 'express';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function buildResponse(): jest.Mocked<Pick<Response, 'setHeader'>> {
  return { setHeader: jest.fn() };
}

describe('correlationIdMiddleware', () => {
  it('gera um novo x-request-id quando o cliente não envia nenhum', () => {
    const req = buildRequest();
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    correlationIdMiddleware(req, res as unknown as Response, next);

    expect(req.headers[CORRELATION_ID_HEADER]).toMatch(UUID_V4_REGEX);
    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      req.headers[CORRELATION_ID_HEADER],
    );
    expect(next).toHaveBeenCalled();
  });

  it('repassa o x-request-id recebido do cliente/proxy em vez de gerar um novo', () => {
    const req = buildRequest({ [CORRELATION_ID_HEADER]: 'id-vindo-do-proxy' });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    correlationIdMiddleware(req, res as unknown as Response, next);

    expect(req.headers[CORRELATION_ID_HEADER]).toBe('id-vindo-do-proxy');
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'id-vindo-do-proxy');
  });

  it('gera um novo id quando o header recebido é uma string vazia', () => {
    const req = buildRequest({ [CORRELATION_ID_HEADER]: '   ' });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    correlationIdMiddleware(req, res as unknown as Response, next);

    expect(req.headers[CORRELATION_ID_HEADER]).toMatch(UUID_V4_REGEX);
  });

  it('gera ids diferentes em chamadas diferentes', () => {
    const next = jest.fn() as NextFunction;

    const req1 = buildRequest();
    correlationIdMiddleware(req1, buildResponse() as unknown as Response, next);

    const req2 = buildRequest();
    correlationIdMiddleware(req2, buildResponse() as unknown as Response, next);

    expect(req1.headers[CORRELATION_ID_HEADER]).not.toBe(req2.headers[CORRELATION_ID_HEADER]);
  });
});
