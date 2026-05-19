import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateCategorySchema = z.object({
  nome: z.string().min(1).max(80),
});

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
