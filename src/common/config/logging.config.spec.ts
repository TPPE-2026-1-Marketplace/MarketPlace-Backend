import { buildPinoHttpOptions, redactRequest } from './logging.config';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

import type { IncomingMessage } from 'node:http';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildRequest(headers: Record<string, string | string[]> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

describe('buildPinoHttpOptions', () => {
  describe('transport', () => {
    it('não configura transport (JSON puro) em produção', () => {
      const options = buildPinoHttpOptions('production');

      expect(options?.transport).toBeUndefined();
    });

    it('não configura transport (JSON puro) em test — pino-pretty usa worker thread e estourou o timeout do job de coverage no CI', () => {
      const options = buildPinoHttpOptions('test');

      expect(options?.transport).toBeUndefined();
    });

    it('não configura transport quando NODE_ENV não está definido (mesmo tratamento de "test"/produção, por segurança)', () => {
      const options = buildPinoHttpOptions(undefined);

      expect(options?.transport).toBeUndefined();
    });

    it('configura pino-pretty só em desenvolvimento interativo', () => {
      const options = buildPinoHttpOptions('development');

      expect(options?.transport).toEqual(expect.objectContaining({ target: 'pino-pretty' }));
    });
  });

  describe('genReqId', () => {
    it('reaproveita o x-request-id já presente no request (setado pelo correlationIdMiddleware)', () => {
      const options = buildPinoHttpOptions('production');
      const req = buildRequest({ [CORRELATION_ID_HEADER]: 'id-ja-definido' });

      const id = options?.genReqId?.(req, undefined as never);

      expect(id).toBe('id-ja-definido');
    });

    it('gera um novo id quando o header ainda não foi definido', () => {
      const options = buildPinoHttpOptions('production');
      const req = buildRequest();

      const id = options?.genReqId?.(req, undefined as never);

      expect(id).toMatch(UUID_V4_REGEX);
    });

    it('usa o primeiro valor quando o header vem como array', () => {
      const options = buildPinoHttpOptions('production');
      const req = buildRequest({ [CORRELATION_ID_HEADER]: ['primeiro', 'segundo'] });

      const id = options?.genReqId?.(req, undefined as never);

      expect(id).toBe('primeiro');
    });
  });
});

describe('redactRequest', () => {
  it('mascara o query param secret na url e no query', () => {
    const result = redactRequest({
      url: '/api/payments/webhook?secret=abc123&x=1',
      query: { secret: 'abc123', x: '1' },
    });

    expect(result.url).toBe('/api/payments/webhook?secret=[REDACTED]&x=1');
    expect(result.query).toEqual({ secret: '[REDACTED]', x: '1' });
  });

  it('mascara o header x-webhook-secret sem tocar nos demais', () => {
    const result = redactRequest({
      headers: { 'x-webhook-secret': 'abc123', 'user-agent': 'jest' },
    });

    expect(result.headers).toEqual({ 'x-webhook-secret': '[REDACTED]', 'user-agent': 'jest' });
  });

  it('mantém intacta uma requisição sem dados sensíveis', () => {
    const req = { url: '/api/products?page=2', query: { page: '2' }, headers: { host: 'x' } };

    expect(redactRequest(req)).toEqual(req);
  });

  it('registra o serializer no pinoHttp', () => {
    expect(buildPinoHttpOptions('production')).toHaveProperty('serializers.req', redactRequest);
  });
});
