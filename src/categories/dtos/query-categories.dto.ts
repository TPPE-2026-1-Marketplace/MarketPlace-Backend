import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX_LIMIT,
} from '../../common/constants';

export const QueryCategoriesSchema = z.object({
  page: z.coerce.number().int().positive().default(PAGINATION_DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION_MAX_LIMIT)
    .default(PAGINATION_DEFAULT_LIMIT),
});

export class QueryCategoriesDto extends createZodDto(QueryCategoriesSchema) {}
