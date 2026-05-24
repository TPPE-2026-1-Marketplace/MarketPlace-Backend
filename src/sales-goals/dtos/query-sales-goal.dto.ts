import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QuerySalesGoalSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(),
  ano: z.coerce.number().int().positive().optional(),
});

export class QuerySalesGoalDto extends createZodDto(QuerySalesGoalSchema) {}
