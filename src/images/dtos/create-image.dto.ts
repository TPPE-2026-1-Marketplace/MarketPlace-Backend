import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateImageSchema = z.object({
  url: z.string().min(1).max(500),
  ordem: z.number().int().optional(),
  descricao: z.string().max(255).optional(),
  local_renderizacao: z.string().max(120).optional(),
});

export class CreateImageDto extends createZodDto(CreateImageSchema) {}
