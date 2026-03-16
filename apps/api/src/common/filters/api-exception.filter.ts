import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const requestId = request.requestId ?? request.headers['x-request-id']?.toString() ?? randomUUID();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    const payload = this.normalizeException(exceptionResponse, statusCode, request, requestId);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request.method} ${request.url} -> ${statusCode} [${requestId}]`, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode} [${requestId}] ${payload.message}`);
    }

    response.setHeader('x-request-id', requestId);
    response.status(statusCode).json(payload);
  }

  private normalizeException(
    exceptionResponse: string | object | null,
    statusCode: number,
    request: Request,
    requestId: string
  ) {
    let message = 'Errore interno del server';
    let details: string[] | undefined;
    let code = this.defaultCodeForStatus(statusCode);

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const candidate = exceptionResponse as { message?: string | string[]; error?: string; code?: string };
      if (typeof candidate.message === 'string') {
        message = candidate.message;
      }
      if (Array.isArray(candidate.message)) {
        details = candidate.message.map((item) => String(item));
        message = details[0] ?? message;
      }
      if (candidate.error && !details?.length) {
        details = [candidate.error];
      }
      if (candidate.code) {
        code = candidate.code;
      }
    }

    return {
      statusCode,
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId
    };
  }

  private defaultCodeForStatus(statusCode: number) {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
