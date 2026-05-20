import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '../../common/enums/role.enum';

/**
 * DTO interno para cadastro de Employee.
 *
 * Nesta subissue (#46), o fluxo ainda é de infraestrutura: o service apenas
 * garante que a Person exista e que a especialização 1:1 seja persistida.
 * O endpoint admin com payload combinado fica para a issue #47.
 */
export const CreateEmployeeSchema = z.object({
    cpf: z
        .string()
        .regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos numéricos'),
    role_perfil: z.nativeEnum(Role),
    ativo: z.boolean().optional(),
    taxa_comissao: z.coerce.number().positive().max(1).optional(),
    meta_vendas: z.coerce.number().nonnegative().nullable().optional(),
    codigo_funcionario: z.string().max(20).nullable().optional(),
});

export class CreateEmployeeDto extends createZodDto(CreateEmployeeSchema) { }
