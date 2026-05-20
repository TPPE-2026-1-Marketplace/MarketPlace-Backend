import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MovementType } from '../entities/stock-log.entity';

export const QueryStockLogsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  tipoMovimentacao: z.nativeEnum(MovementType).optional(),
  dataInicio: z.string().datetime({ offset: true }).optional(),
  dataFim: z.string().datetime({ offset: true }).optional(),
});

export class QueryStockLogsDto extends createZodDto(QueryStockLogsSchema) {}
