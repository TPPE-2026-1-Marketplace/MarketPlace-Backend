import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryProgressSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(),
  ano: z.coerce.number().int().positive().optional(),
});

export class QueryProgressDto extends createZodDto(QueryProgressSchema) {}
