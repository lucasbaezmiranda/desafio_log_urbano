import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../errors/error-codes';
import { BusinessException } from '../errors/business.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let error: string;
    let errorCode: string;
    let message: string;

    if (exception instanceof BusinessException) {
      statusCode = exception.getStatus();
      errorCode = exception.errorCode;
      error = HttpStatus[statusCode] || 'UNKNOWN_ERROR';
      const res = exception.getResponse() as { message: string };
      message = res.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      error = HttpStatus[statusCode] || 'UNKNOWN_ERROR';
      const res = exception.getResponse() as string | Record<string, any>;

      if (typeof res === 'string') {
        message = res;
        errorCode = this.mapStatusToErrorCode(statusCode);
      } else {
        // Handle ValidationPipe errors (array of messages)
        if (Array.isArray(res.message)) {
          message = res.message.join('; ');
        } else {
          message = res.message || exception.message;
        }
        errorCode = this.mapStatusToErrorCode(statusCode);
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'INTERNAL_SERVER_ERROR';
      errorCode = ErrorCode.INTERNAL_ERROR;
      message = 'Internal server error';

      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      statusCode,
      error,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private mapStatusToErrorCode(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.CLIENT_NOT_FOUND;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
