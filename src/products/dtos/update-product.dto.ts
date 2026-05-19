import { createZodDto } from 'nestjs-zod';
import { CreateProductSchema } from './create-product.dto';

export const UpdateProductSchema = CreateProductSchema.partial();

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
