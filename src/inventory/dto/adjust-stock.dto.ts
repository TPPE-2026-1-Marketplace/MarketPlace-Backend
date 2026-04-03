import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({
    example: 10,
    description: 'New quantity value (absolute, not delta)',
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 'Correction after physical inventory count' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
