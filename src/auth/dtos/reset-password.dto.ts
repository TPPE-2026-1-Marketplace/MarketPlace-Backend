import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResetPasswordSchema = z.object({
  // base64url de 32 bytes = 43 caracteres; o limite só barra lixo.
  token: z.string().trim().min(20, 'Link inválido').max(200, 'Link inválido'),
  novaSenha: z.string().min(8).max(72),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
