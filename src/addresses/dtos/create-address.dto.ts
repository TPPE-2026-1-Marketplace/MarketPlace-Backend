import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateAddressSchema = z.object({
  cep: z.string().regex(/^\d{8}$/, 'CEP deve conter exatamente 8 dígitos numéricos'),
  logradouro: z.string().min(1).max(255),
  numero: z.string().min(1).max(20),
  complemento: z.string().max(255).optional(),
  bairro: z.string().min(1).max(100),
  cidade: z.string().min(1).max(100),
  uf: z.string().length(2),
});

export class CreateAddressDto extends createZodDto(CreateAddressSchema) {}
