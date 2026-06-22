import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { OrderStatus } from '../entities/order.entity';

export const UpdateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export class UpdateStatusDto extends createZodDto(UpdateStatusSchema) {}
