import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-codes';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  login(username: string, password: string) {
    if (username !== 'test' || password !== 'test') {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'Credenciales inválidas');
    }
    const payload = { sub: '1', username };
    return { access_token: this.jwtService.sign(payload) };
  }
}
