import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryRankingSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(),
  ano: z.coerce.number().int().positive().optional(),
});

export class QueryRankingDto extends createZodDto(QueryRankingSchema) {}
