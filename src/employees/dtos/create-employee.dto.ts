import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CpfSchema, PhoneSchema } from '../../common/dtos';
import { Role } from '../../common/enums/role.enum';

export const CreateEmployeeSchema = z.object({
  cpf: CpfSchema,
  nome: z.string().min(1).max(120),
  email: z.email().max(160),
  telefone: PhoneSchema.optional(),
  ativo: z.boolean().optional(),
  role_perfil: z.enum(Role),
  taxa_comissao: z.coerce.number().positive().max(1).optional(),
  meta_vendas: z.coerce.number().nonnegative().nullable().optional(),
  codigo_funcionario: z.string().max(20).nullable().optional(),
  senha: z.string().min(3).optional(),
});

export class CreateEmployeeDto extends createZodDto(CreateEmployeeSchema) {}
