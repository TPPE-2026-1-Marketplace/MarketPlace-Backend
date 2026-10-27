import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { PG_UNIQUE_VIOLATION } from '../constants';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorField {
  field: string;
  message: string;
}

interface ZodIssueLike {
  path?: Array<string | number>;
  message: string;
}

interface ResolvedError {
  statusCode: number;
  message: string;
  errors?: ErrorField[];
}

/**
 * Último filtro de erro da aplicação. Padroniza toda resposta de erro não
 * tratada por um controller/service, no formato documentado no CLAUDE.md,
 * e inclui o x-request-id (ver correlation-id.middleware) na resposta e no
 * log — para ligar o erro que o cliente recebeu ao log correspondente.
 *
 * Erros HTTP já lançados explicitamente (NotFoundException, ForbiddenException,
 * ZodValidationException, etc.) só são reformatados no envelope padrão —
 * services que já tratam um caso específico (ex.: ProductsService com SKU
 * duplicado, issue #158) continuam funcionando como antes; este filtro é a
 * rede de segurança para os casos que ainda não têm tratamento próprio.
 */
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = this.extractRequestId(request);

    const resolved = this.resolveError(exception);

    this.logError(exception, resolved.statusCode, requestId, request);

    response.status(resolved.statusCode).json({
      statusCode: resolved.statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: resolved.message,
      ...(resolved.errors ? { errors: resolved.errors } : {}),
      ...(requestId ? { requestId } : {}),
    });
  }

  private resolveError(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    if (this.isUniqueViolation(exception)) {
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'Já existe um registro com esses dados.',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
    };
  }

  private resolveHttpException(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { statusCode, message: body };
    }

    const bodyObj = body as Record<string, unknown>;
    const message = typeof bodyObj.message === 'string' ? bodyObj.message : exception.message;
    const errors = this.extractZodErrors(bodyObj.errors);

    return { statusCode, message, ...(errors ? { errors } : {}) };
  }

  private extractZodErrors(rawErrors: unknown): ErrorField[] | undefined {
    if (!Array.isArray(rawErrors)) {
      return undefined;
    }

    return (rawErrors as ZodIssueLike[]).map((issue) => ({
      field: issue.path && issue.path.length > 0 ? issue.path.join('.') : '(root)',
      message: issue.message,
    }));
  }

  private isUniqueViolation(exception: unknown): boolean {
    if (!(exception instanceof QueryFailedError)) {
      return false;
    }

    const driverError = exception.driverError as { code?: string } | undefined;
    return driverError?.code === PG_UNIQUE_VIOLATION;
  }

  private extractRequestId(request: Request): string | undefined {
    const header = request.headers[CORRELATION_ID_HEADER];
    return Array.isArray(header) ? header[0] : header;
  }

  private logError(
    exception: unknown,
    statusCode: number,
    requestId: string | undefined,
    request: Request,
  ): void {
    const context = `${request.method} ${request.url} [${requestId ?? 'sem-id'}]`;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${context} - erro não tratado`, stack);
      return;
    }

    this.logger.warn(`${context} - ${statusCode}`);
  }
}
