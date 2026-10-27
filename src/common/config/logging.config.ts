import { randomUUID } from 'node:crypto';

import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';

/**
 * Configuração do nestjs-pino (issue #165): JSON puro em produção e em
 * test, pino-pretty (legível/colorido) só em desenvolvimento interativo.
 *
 * `pino-pretty` roda numa worker thread própria (pacote `thread-stream`)
 * pra formatar cada linha sem bloquear o event loop. Isso é ótimo pra uma
 * pessoa olhando o terminal, mas caro quando o Jest sobe a AppModule
 * inteira de novo a cada um dos ~12 arquivos de teste de integração
 * (`--runInBand`, sequencial): cada boot cria sua própria worker thread.
 * No CI (`NODE_ENV=test`), isso estourou os 15 min do job `coverage` —
 * por isso o pretty fica restrito a `NODE_ENV=development` mesmo, e não a
 * "qualquer coisa que não seja produção".
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
export function buildPinoHttpOptions(nodeEnv: string | undefined): Params['pinoHttp'] {
  const usePrettyTransport = nodeEnv === 'development';

  return {
    genReqId: (req: IncomingMessage) => {
      const header = req.headers[CORRELATION_ID_HEADER];
      const value = Array.isArray(header) ? header[0] : header;
      return value ?? randomUUID();
    },
    transport: usePrettyTransport
      ? {
          target: 'pino-pretty',
          options: { singleLine: true, colorize: true, translateTime: 'HH:MM:ss' },
        }
      : undefined,
  };
}
