import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CreateAddressSchema } from '../../addresses/dtos/create-address.dto';
import { CpfSchema, PhoneSchema } from '../../common/dtos';

export const RegisterUserSchema = z.object({
  email: z.email().max(160),
  senha: z.string().min(8).max(72),
  cpf: CpfSchema.optional(),
  nome: z.string().min(1).max(120).optional(),
  telefone: PhoneSchema.optional(),
  endereco: CreateAddressSchema.optional(),
});

export class RegisterUserDto extends createZodDto(RegisterUserSchema) {}
