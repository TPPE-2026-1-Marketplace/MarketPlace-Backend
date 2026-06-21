import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateSalesGoalSchema = z.object({
  cpfFuncionario: z
    .string()
    .length(11, 'O CPF do funcionário deve conter exatamente 11 caracteres')
    .optional()
    .nullable(),
  mes: z
    .number()
    .int('O mês deve ser um número inteiro')
    .min(1, 'O mês deve estar entre 1 e 12')
    .max(12, 'O mês deve estar entre 1 e 12'),
  ano: z
    .number()
    .int('O ano deve ser um número inteiro')
    .positive('O ano deve ser um número positivo'),
  valorMeta: z.number().nonnegative('O valor da meta não pode ser negativo'),
  taxaComissaoBonus: z
    .number()
    .nonnegative('A comissão bônus não pode ser negativa')
    .max(1, 'A taxa de comissão bônus não pode ser maior que 1 (100%)')
    .optional()
    .nullable(),
});

export class CreateSalesGoalDto extends createZodDto(CreateSalesGoalSchema) {}
