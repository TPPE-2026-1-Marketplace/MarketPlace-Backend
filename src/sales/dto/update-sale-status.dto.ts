import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SaleStatus } from '@prisma/client';

export class UpdateSaleStatusDto {
  @ApiProperty({ enum: SaleStatus })
  @IsEnum(SaleStatus)
  status: SaleStatus;
}
