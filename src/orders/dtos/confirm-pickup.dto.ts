import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ConfirmPickupSchema = z.object({
  pin: z
    .string()
    .length(6, 'O PIN de verificação deve conter exatamente 6 dígitos')
    .regex(/^\d+$/, 'O PIN de verificação deve conter apenas números')
    .trim(),
});

export class ConfirmPickupDto extends createZodDto(ConfirmPickupSchema) {}
