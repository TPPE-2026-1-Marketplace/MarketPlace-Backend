import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DressCategory } from '@prisma/client';

export class FilterProductDto {
  @ApiPropertyOptional({ enum: DressCategory })
  @IsEnum(DressCategory)
  @IsOptional()
  category?: DressCategory;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}
