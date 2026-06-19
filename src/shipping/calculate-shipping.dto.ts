import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalculateShippingDto {
  @ApiProperty({ description: 'CEP de destino (apenas dígitos)', example: '70002900' })
  @IsString()
  cep_destino: string;

  @ApiPropertyOptional({ description: 'Peso total em kg', default: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  peso?: number;

  @ApiPropertyOptional({ description: 'Altura em cm', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  altura?: number;

  @ApiPropertyOptional({ description: 'Largura em cm', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  largura?: number;

  @ApiPropertyOptional({ description: 'Comprimento em cm', default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  comprimento?: number;

  @ApiPropertyOptional({ description: 'Valor da mercadoria para seguro', default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  valor_declarado?: number;
}
