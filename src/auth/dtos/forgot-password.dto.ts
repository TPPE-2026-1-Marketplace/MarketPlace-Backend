import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ForgotPasswordSchema = z.object({
  // Mesma busca exata do login (o e-mail é gravado como foi cadastrado).
  email: z.email('Email inválido'),
});

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
