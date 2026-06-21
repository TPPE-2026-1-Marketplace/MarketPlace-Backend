import { IsString, IsNumber, IsOptional, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class OrderItemDto {
  @ApiProperty()
  @IsNumber()
  productId: number;

  @ApiProperty()
  @IsNumber()
  variantId: number;

  @ApiProperty()
  @IsString()
  titulo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tamanho?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cor?: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantidade: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  preco_unitario: number;
}

class EnderecoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rua?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complemento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bairro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  estado?: string;
}

class ClienteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  cpf: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefone?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  frete?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  desconto?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty()
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ type: EnderecoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco?: EnderecoDto;

  @ApiPropertyOptional({ type: ClienteDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteDto)
  cliente?: ClienteDto;
}
