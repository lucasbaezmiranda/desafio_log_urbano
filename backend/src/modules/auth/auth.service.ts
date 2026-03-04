import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  login(username: string, password: string) {
    if (username !== 'test' || password !== 'test') {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = { sub: '1', username };
    return { access_token: this.jwtService.sign(payload) };
  }
}
