import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Schema Zod para validação da atualização parcial de Cupons de Desconto.
 * Todas as propriedades são opcionais.
 */
export const UpdateCouponSchema = z
  .object({
    tipoCupom: z
      .enum(['fixo', 'porcentagem'], {
        message: "O tipo do cupom deve ser 'fixo' ou 'porcentagem'",
      })
      .optional(),
    valorDesconto: z
      .number()
      .positive('O valor do desconto deve ser um número positivo')
      .optional(),
    ativo: z.boolean().optional(),
    dataInicio: z.iso.datetime({ message: 'Data de início inválida (use ISO 8601)' }).optional(),
    dataFim: z.iso.datetime({ message: 'Data de fim inválida (use ISO 8601)' }).optional(),
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
    usosAtuais: z
      .number()
      .int()
      .nonnegative('A quantidade de usos atuais deve ser não negativa')
      .optional(),
  })
  .refine(
    (data) => {
      // Se ambas as datas estiverem presentes na atualização, valida se dataFim > dataInicio
      if (data.dataInicio !== undefined && data.dataFim !== undefined) {
        return data.dataFim > data.dataInicio;
      }
      return true;
    },
    {
      message: 'A data de fim deve ser posterior à data de início',
      path: ['dataFim'],
    },
  )
  .refine(
    (data) => {
      // Se tipoCupom for atualizado para porcentagem e valorDesconto estiver presente, garante limite de 100
      if (data.tipoCupom === 'porcentagem' && data.valorDesconto !== undefined) {
        return data.valorDesconto <= 100;
      }
      return true;
    },
    {
      message: 'Para cupons do tipo porcentagem, o desconto máximo é de 100%',
      path: ['valorDesconto'],
    },
  );

export class UpdateCouponDto extends createZodDto(UpdateCouponSchema) {}
