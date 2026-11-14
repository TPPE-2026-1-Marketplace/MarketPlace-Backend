import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { THROTTLE_AUTH, THROTTLE_PASSWORD_RESET } from '../common/config/throttle.config';

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

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @Throttle(THROTTLE_PASSWORD_RESET)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Envia por e-mail o link de redefinição de senha (Público). Mesma resposta para e-mail cadastrado ou não.',
  })
  @ApiResponse({ status: 200, description: '{ message } — resposta genérica' })
  @ApiResponse({ status: 400, description: 'E-mail em formato inválido' })
  @ApiResponse({ status: 429, description: 'Limite de requisições excedido' })
  @ApiResponse({ status: 503, description: 'Envio de e-mail não configurado no servidor' })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @Throttle(THROTTLE_PASSWORD_RESET)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Define uma nova senha a partir do link enviado por e-mail (Público)' })
  @ApiResponse({ status: 200, description: '{ message } — senha redefinida' })
  @ApiResponse({
    status: 400,
    description: 'Link inválido, expirado ou já usado; ou senha fora das regras',
  })
  @ApiResponse({ status: 429, description: 'Limite de requisições excedido' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }
}
