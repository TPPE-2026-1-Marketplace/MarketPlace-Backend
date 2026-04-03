import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { DressCategory } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'Vestido Longo Bordado' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Vestido longo com bordados florais' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 299.99 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ enum: DressCategory, example: DressCategory.LONGO })
  @IsEnum(DressCategory)
  category: DressCategory;

  @ApiPropertyOptional({ example: '100% Poliéster' })
  @IsString()
  @IsOptional()
  fabricComposition?: string;

  @ApiPropertyOptional({ example: 90, description: 'Bust measurement in cm' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  bust?: number;

  @ApiPropertyOptional({ example: 70, description: 'Waist measurement in cm' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  waist?: number;

  @ApiPropertyOptional({ example: 95, description: 'Hips measurement in cm' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  hips?: number;

  @ApiPropertyOptional({
    example: 140,
    description: 'Length measurement in cm',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  length?: number;

  @ApiProperty({ example: 'VLB-001' })
  @IsString()
  @IsNotEmpty()
  sku: string;
}
