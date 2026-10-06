import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-request-id';

/**
 * Garante que toda requisição tenha um x-request-id, repassando o valor
 * enviado pelo cliente/proxy quando houver, ou gerando um novo caso contrário.
 * O ID é devolvido no header de resposta e fica disponível em `req.headers`
 * para quem precisar incluí-lo em logs (ver AllExceptionsFilter).
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[CORRELATION_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : randomUUID();

  req.headers[CORRELATION_ID_HEADER] = requestId;
  res.setHeader(CORRELATION_ID_HEADER, requestId);

  next();
}
