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

export const QueryProductsSchema = z
  .object({
    page: z.coerce.number().int().positive().default(PAGINATION_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(PAGINATION_MAX_LIMIT)
      .default(PAGINATION_DEFAULT_LIMIT),
    categoryId: z.coerce.number().int().positive().optional(),
    destaque: booleanQuery.optional(),
    precoMin: z.coerce.number().nonnegative().optional(),
    precoMax: z.coerce.number().nonnegative().optional(),
  })
  .refine(
    (query) =>
      query.precoMin === undefined ||
      query.precoMax === undefined ||
      query.precoMin <= query.precoMax,
    {
      message: 'precoMin deve ser menor ou igual a precoMax',
      path: ['precoMin'],
    },
  );

export class QueryProductsDto extends createZodDto(QueryProductsSchema) {}
