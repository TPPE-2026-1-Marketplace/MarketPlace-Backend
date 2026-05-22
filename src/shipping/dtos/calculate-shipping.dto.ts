import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Schema para cálculo de frete em `POST /api/shipping/calculate`.
 *
 * - `cep_destino`: obrigatório, exatamente 8 dígitos numéricos (sem máscara).
 * - `peso`: opcional, peso em kg (positivo). Padrão será tratado no service.
 * - `dimensoes`: opcional, objeto com comprimento, largura e altura em cm.
 */
const DimensoesSchema = z.object({
  comprimento: z.number().positive().max(200).describe('Comprimento em cm'),
  largura: z.number().positive().max(200).describe('Largura em cm'),
  altura: z.number().positive().max(200).describe('Altura em cm'),
});

export const CalculateShippingSchema = z.object({
  cep_destino: z
    .string()
    .regex(
      /^\d{8}$/,
      'CEP deve conter exatamente 8 dígitos numéricos (sem máscara)',
    ),
  peso: z.number().positive().max(30).optional().describe('Peso em kg'),
  dimensoes: DimensoesSchema.optional(),
});

export class CalculateShippingDto extends createZodDto(
  CalculateShippingSchema,
) {}
