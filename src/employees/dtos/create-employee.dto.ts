import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Role } from '../../common/enums/role.enum';

export const CreateEmployeeSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos numéricos'),
  nome: z.string().min(1).max(120),
  email: z.string().email().max(160),
  telefone: z.string().max(20).optional(),
  ativo: z.boolean().optional(),
  role_perfil: z.nativeEnum(Role),
  taxa_comissao: z.coerce.number().positive().max(1).optional(),
  meta_vendas: z.coerce.number().nonnegative().nullable().optional(),
  codigo_funcionario: z.string().max(20).nullable().optional(),
});

export class CreateEmployeeDto extends createZodDto(CreateEmployeeSchema) {}
