import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX_LIMIT,
} from '../../common/constants';
import { MovementType } from '../entities/stock-log.entity';

export const QueryStockLogsSchema = z.object({
  page: z.coerce.number().int().positive().default(PAGINATION_DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION_MAX_LIMIT)
    .default(PAGINATION_DEFAULT_LIMIT),
  tipoMovimentacao: z.enum(MovementType).optional(),
  dataInicio: z.iso.datetime({ offset: true }).optional(),
  dataFim: z.iso.datetime({ offset: true }).optional(),
});

export class QueryStockLogsDto extends createZodDto(QueryStockLogsSchema) {}
