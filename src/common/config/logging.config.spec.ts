import { buildPinoHttpOptions } from './logging.config';
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
