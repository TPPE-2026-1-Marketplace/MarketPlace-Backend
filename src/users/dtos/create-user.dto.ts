import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Nome completo do usuário',
  })
  @IsString()
  readonly name: string;

  @ApiProperty({
    example: 'email@email.com',
    description: 'E-mail do usuário',
  })
  @IsEmail()
  readonly email: string;

  @ApiProperty({
    example: '123456',
    description: 'Senha com mínimo de 6 caracteres',
  })
  @IsString()
  @MinLength(6)
  readonly password: string;

  @ApiProperty({
    example: '12345678901',
    description: 'CPF do usuário',
  })
  @IsString()
  readonly cpf: string;

  @ApiProperty({
    example: '(55) 99999-9999',
    description: 'Telefone do usuário',
  })
  @IsString()
  readonly telefone: string;
}