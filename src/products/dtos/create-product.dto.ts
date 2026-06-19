import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Título do produto' })
  @IsString()
  titulo: string;

  @ApiProperty({ description: 'Preço base' })
  @IsNumber()
  @Min(0)
  preco_base: number;

  @ApiPropertyOptional({ description: 'Descrição do produto' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Categoria' })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiPropertyOptional({ description: 'URL da imagem' })
  @IsOptional()
  @IsString()
  imagem_url?: string;

  @ApiPropertyOptional({ description: 'Preço original (para exibir desconto)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  preco_original?: number;
}
