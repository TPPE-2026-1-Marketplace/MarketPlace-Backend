import { createZodDto } from 'nestjs-zod';

import { CreateProductVariantSchema } from './create-product-variant.dto';

export const UpdateProductVariantSchema = CreateProductVariantSchema.omit({
  idProduto: true,
  codigoSku: true,
}).partial();

export class UpdateProductVariantDto extends createZodDto(UpdateProductVariantSchema) {}
