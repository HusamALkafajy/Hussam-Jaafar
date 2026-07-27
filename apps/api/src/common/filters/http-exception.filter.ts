import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger, LoggerService } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService = new Logger(HttpExceptionFilter.name)) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any).message || exception.message
        : 'Internal server error';

    const error =
      exception instanceof HttpException
        ? (exception.getResponse() as any).error || exception.name
        : exception.name || 'Error';

    // Log the error with minimal, sanitized information to avoid leaking tokens/PII
    const safeLog = {
      path: request.url,
      status,
      error,
      message: Array.isArray(message) ? message[0] : message,
      timestamp: new Date().toISOString(),
    };
    this.logger.error(safeLog);

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message: Array.isArray(message) ? message[0] : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
