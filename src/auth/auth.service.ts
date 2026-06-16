import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService, SafeUser } from '../users/services/users.service';
import { LoginDto } from './dtos/login.dto';

export interface LoginResponse {
  access_token: string;
  user: SafeUser;
}

@Injectable()
export class AuthService {
  private static readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login({ email, password }: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      AuthService.logger.warn(`Tentativa de login inválida para email=${email}`);
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = await this.jwtService.signAsync(payload);

    AuthService.logger.log(`Login bem-sucedido para email=${email} (id=${user.id})`);

    return {
      access_token,
      user: this.usersService.toSafeUser(user),
    };
  }
}
