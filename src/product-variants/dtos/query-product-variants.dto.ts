import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX_LIMIT,
} from '../../common/constants';

const booleanQuery = z.preprocess((value) => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}, z.boolean());

export const QueryProductVariantsSchema = z.object({
  page: z.coerce.number().int().positive().default(PAGINATION_DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION_MAX_LIMIT)
    .default(PAGINATION_DEFAULT_LIMIT),
  ativo: booleanQuery.default(true),
});

export class QueryProductVariantsDto extends createZodDto(QueryProductVariantsSchema) {}
