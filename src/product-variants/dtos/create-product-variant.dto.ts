import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProductVariantSchema = z.object({
  idProduto: z.number().int().positive(),
  codigo_sku: z.string().min(1).max(80),
  preco_variante: z.number().positive(),
  ativo: z.boolean().optional(),
  cor: z.string().max(80).optional(),
  tamanho: z.string().max(40).optional(),
});

export class CreateProductVariantDto extends createZodDto(
  CreateProductVariantSchema,
) {}
