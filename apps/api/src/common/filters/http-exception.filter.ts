import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger, LoggerService } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  isMulterFileSizeError,
  uploadFileSizeException,
} from '../files/upload-contract';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService = new Logger(HttpExceptionFilter.name)) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalizedException = isMulterFileSizeError(exception) ||
      (exception instanceof HttpException && exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE)
      ? uploadFileSizeException()
      : exception;
    const exceptionResponse = normalizedException instanceof HttpException
      ? normalizedException.getResponse() as any
      : undefined;

    const status =
      normalizedException instanceof HttpException
        ? normalizedException.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      normalizedException instanceof HttpException
        ? exceptionResponse.message || normalizedException.message
        : 'Internal server error';

    const error =
      normalizedException instanceof HttpException
        ? exceptionResponse.error || normalizedException.name
        : normalizedException.name || 'Error';
    const errorCode = exceptionResponse?.errorCode;

    // Log the error with minimal, sanitized information to avoid leaking tokens/PII
    const safeLog = {
      path: request.url,
      status,
      error,
      message: Array.isArray(message) ? message[0] : message,
      ...(errorCode ? { errorCode } : {}),
      timestamp: new Date().toISOString(),
    };
    this.logger.error(safeLog);


    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message: Array.isArray(message) ? message[0] : message,
      ...(errorCode ? { errorCode } : {}),
      ...(exceptionResponse?.maxBytes ? { maxBytes: exceptionResponse.maxBytes } : {}),
      ...(exceptionResponse?.limitType ? { limitType: exceptionResponse.limitType } : {}),
      ...(exceptionResponse?.used !== undefined ? { used: exceptionResponse.used } : {}),
      ...(exceptionResponse?.limit !== undefined ? { limit: exceptionResponse.limit } : {}),
      ...(exceptionResponse?.tier ? { tier: exceptionResponse.tier } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
