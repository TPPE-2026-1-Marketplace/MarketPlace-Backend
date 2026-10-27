import { randomUUID } from 'node:crypto';

import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';

/**
 * Configuração do nestjs-pino (issue #165): JSON puro em produção,
 * pino-pretty (legível/colorido) fora de produção.
 *
 * `genReqId` reaproveita o x-request-id já atribuído pelo
 * `correlationIdMiddleware` (issue #164), pra cada linha de log carregar o
 * mesmo identificador que vai no header de resposta — se por algum motivo
 * esse middleware ainda não rodou nessa requisição, gera um novo em vez de
 * deixar o log sem id.
 *
 * Mora fora de `app.module.ts` de propósito, mesmo critério do
 * `swagger.config.ts`: fica testável isoladamente, sem precisar montar o
 * módulo inteiro.
 */
export function buildPinoHttpOptions(isProduction: boolean): Params['pinoHttp'] {
  return {
    genReqId: (req: IncomingMessage) => {
      const header = req.headers[CORRELATION_ID_HEADER];
      const value = Array.isArray(header) ? header[0] : header;
      return value ?? randomUUID();
    },
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: { singleLine: true, colorize: true, translateTime: 'HH:MM:ss' },
        },
  };
}
