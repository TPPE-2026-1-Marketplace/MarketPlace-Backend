import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProductSchema = z.object({
  titulo: z.string().min(1).max(180),
  descricao: z.string().optional(),
  destaque: z.boolean().optional(),
  qual_medida: z.string().max(80).optional(),
  material: z.string().max(120).optional(),
  composicao: z.string().max(180).optional(),
  silhueta: z.string().max(120).optional(),
  tags: z.array(z.string().min(1)).optional(),
  preco_base: z.number().positive(),
  SKU: z.string().min(1).max(80),
});

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
