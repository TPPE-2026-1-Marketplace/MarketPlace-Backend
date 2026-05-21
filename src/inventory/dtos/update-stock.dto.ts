import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MovementType } from '../entities/stock-log.entity';

export const UpdateStockSchema = z
  .object({
    qtdOnline: z.number().int().min(0).optional(),
    qtdLojaFisica: z.number().int().min(0).optional(),
    motivo: z.string().max(200).optional(),
    tipoMovimentacao: z
      .nativeEnum(MovementType)
      .default(MovementType.AJUSTE),
  })
  .refine(
    (data) => data.qtdOnline !== undefined || data.qtdLojaFisica !== undefined,
    { message: 'Informe ao menos qtdOnline ou qtdLojaFisica' },
  );

export class UpdateStockDto extends createZodDto(UpdateStockSchema) {}
