import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export class BusinessException extends HttpException {
  public readonly errorCode: ErrorCode;

  constructor(status: HttpStatus, errorCode: ErrorCode, message: string) {
    super({ message, errorCode }, status);
    this.errorCode = errorCode;
  }
}
