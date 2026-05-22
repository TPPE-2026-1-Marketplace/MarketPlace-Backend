import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateTrackingSchema = z.object({
  codigo_rastreamento: z
    .string()
    .trim()
    .min(3, 'O código de rastreamento deve ter pelo menos 3 caracteres'),
});

export class UpdateTrackingDto extends createZodDto(UpdateTrackingSchema) {}
