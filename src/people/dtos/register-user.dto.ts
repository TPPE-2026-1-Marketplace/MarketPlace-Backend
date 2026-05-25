import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CreateAddressSchema } from '../../addresses/dtos/create-address.dto';

export const RegisterUserSchema = z.object({
  email: z.email().max(160),
  senha: z.string().min(8).max(72),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos numéricos')
    .optional(),
  nome: z.string().min(1).max(120).optional(),
  telefone: z.string().max(20).optional(),
  endereco: CreateAddressSchema.optional(),
});

export class RegisterUserDto extends createZodDto(RegisterUserSchema) {}
