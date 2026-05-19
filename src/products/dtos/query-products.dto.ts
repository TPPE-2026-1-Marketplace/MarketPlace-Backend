import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
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
