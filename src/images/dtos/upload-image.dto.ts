import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UploadImageSchema = z.object({
  ordem: z.coerce.number().int().optional(),
  descricao: z.string().max(255).optional(),
  local_renderizacao: z.string().max(120).optional(),
});

export class UploadImageDto extends createZodDto(UploadImageSchema) {}
