import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { THROTTLE_AUTH } from '../common/config/throttle.config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle(THROTTLE_AUTH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica um usuário e retorna um JWT (Público)' })
  @ApiResponse({
    status: 200,
    description: 'Login bem-sucedido',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Email ou senha inválidos',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas de login — limite de requisições excedido',
  })
  async login(@Body() dto: LoginDto): Promise<{ access_token: string }> {
    return this.authService.login(dto);
  }
}
