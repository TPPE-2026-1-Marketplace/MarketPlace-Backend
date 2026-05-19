import { createZodDto } from 'nestjs-zod';
import { CreateCategorySchema } from './create-category.dto';

export const UpdateCategorySchema = CreateCategorySchema.partial();

export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
