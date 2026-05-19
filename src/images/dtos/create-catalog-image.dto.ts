import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateCatalogImageSchema = z.object({
  imageId: z.number().int().positive(),
  variantSku: z.string().min(1).max(80),
  ordem_no_catalogo: z.number().int().optional(),
});

export class CreateCatalogImageDto extends createZodDto(
  CreateCatalogImageSchema,
) {}
