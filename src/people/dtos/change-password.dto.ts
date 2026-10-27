import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ChangePasswordSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8).max(72),
});

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
