import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MeasurementsSchema = z
  .object({
    busto: z.number().positive().optional(),
    cintura: z.number().positive().optional(),
    quadril: z.number().positive().optional(),
    comprimento: z.number().positive().optional(),
    manga: z.number().positive().optional(),
    pulso: z.number().positive().optional(),
  })
  .catchall(z.number().positive());

export const CreateProductVariantSchema = z.object({
  idProduto: z.number().int().positive(),
  codigo_sku: z.string().min(1).max(80),
  preco_variante: z.number().positive(),
  ativo: z.boolean().optional(),
  cor: z.string().max(80).optional(),
  tamanho: z.string().max(40).optional(),
  medidas: MeasurementsSchema.optional(),
});

export class CreateProductVariantDto extends createZodDto(
  CreateProductVariantSchema,
) {}
