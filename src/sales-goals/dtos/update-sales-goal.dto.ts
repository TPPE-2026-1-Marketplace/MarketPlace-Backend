import { createZodDto } from 'nestjs-zod';

import { CreateSalesGoalSchema } from './create-sales-goal.dto';

export const UpdateSalesGoalSchema = CreateSalesGoalSchema.partial();

export class UpdateSalesGoalDto extends createZodDto(UpdateSalesGoalSchema) {}
