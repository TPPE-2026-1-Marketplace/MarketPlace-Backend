import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Schema Zod para validação da criação de Cupons de Desconto.
 *
 * Inclui validações completas e o critério de aceitação de que a data_fim
 * deve ser estritamente posterior à data_inicio (dataFim > dataInicio).
 */
export const CreateCouponSchema = z
  .object({
    numeroDoCupom: z
      .string()
      .min(3, 'O número do cupom deve ter pelo menos 3 caracteres')
      .max(50, 'O número do cupom deve ter no máximo 50 caracteres')
      .toUpperCase()
      .trim(),
    tipoCupom: z.enum(['fixo', 'porcentagem'], {
      message: "O tipo do cupom deve ser 'fixo' ou 'porcentagem'",
    }),
    valorDesconto: z.number().positive('O valor do desconto deve ser um número positivo'),
    ativo: z.boolean().default(true),
    dataInicio: z.coerce.date(),
    dataFim: z.coerce.date(),
    usoMaximo: z
      .number()
      .int()
      .positive('O uso máximo deve ser um número inteiro positivo')
      .optional()
      .nullable(),
    nomeInfluenciador: z
      .string()
      .max(100, 'O nome do influenciador deve ter no máximo 100 caracteres')
      .optional()
      .nullable(),
  })
  .refine((data) => data.dataFim > data.dataInicio, {
    message: 'A data de fim deve ser posterior à data de início',
    path: ['dataFim'],
  })
  .refine(
    (data) => {
      if (data.tipoCupom === 'porcentagem') {
        return data.valorDesconto <= 100;
      }
      return true;
    },
    {
      message: 'Para cupons do tipo porcentagem, o desconto máximo é de 100%',
      path: ['valorDesconto'],
    },
  );

export class CreateCouponDto extends createZodDto(CreateCouponSchema) {}

export const ValidateCouponQuerySchema = z.object({
  productIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((id) => Number(id.trim())) : [])),
});

export class ValidateCouponQueryDto extends createZodDto(ValidateCouponQuerySchema) {}
