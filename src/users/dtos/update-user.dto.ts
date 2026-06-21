import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'Jane Doe',
    description: 'Nome completo do usuário',
  })
  @IsOptional()
  @IsString()
  readonly name?: string;

  @ApiPropertyOptional({
    example: 'novo@email.com',
    description: 'E-mail do usuário',
  })
  @IsOptional()
  @IsEmail()
  readonly email?: string;

  @ApiPropertyOptional({
    example: '654321',
    description: 'Nova senha com mínimo de 6 caracteres',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  readonly password?: string;

  @ApiPropertyOptional({
    example: '12345678901',
    description: 'CPF do usuário',
  })
  @IsOptional()
  @IsString()
  readonly cpf?: string;

  @ApiPropertyOptional({
    example: '(55) 99999-9999',
    description: 'Telefone do usuário',
  })
  @IsOptional()
  @IsString()
  readonly telefone?: string;
}
