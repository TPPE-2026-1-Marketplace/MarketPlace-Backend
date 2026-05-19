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

export const QueryProductVariantsSchema = z.object({
  ativo: booleanQuery.default(true),
});

export class QueryProductVariantsDto extends createZodDto(
  QueryProductVariantsSchema,
) {}
