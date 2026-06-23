import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TipoRetirada } from '../entities/order.entity';

export const CreateOrderItemSchema = z.object({
  variantSku: z.string().min(1, 'O SKU da variante é obrigatório').trim(),
  quantidade: z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .positive('A quantidade deve ser maior que zero'),
});

export const CreateOrderSchema = z.object({
  items: z.array(CreateOrderItemSchema).min(1, 'O pedido deve conter ao menos um item'),
  couponNumero: z.string().toUpperCase().trim().optional().nullable(),
  valorFrete: z.number().nonnegative('O valor do frete não pode ser negativo').default(0),
  tipoRetirada: z.enum(TipoRetirada).default(TipoRetirada.ENTREGA),
  clienteNomeAvulso: z.string().trim().optional().nullable(),
  clienteEmailAvulso: z.string().email('E-mail inválido').optional().nullable(),
  clienteCpfAvulso: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos')
    .optional()
    .nullable(),
  clienteTelefone: z.string().trim().optional().nullable(),
  enderecoCep: z.string().trim().optional().nullable(),
  enderecoRua: z.string().trim().optional().nullable(),
  enderecoNumero: z.string().trim().optional().nullable(),
  enderecoComplemento: z.string().trim().optional().nullable(),
  enderecoBairro: z.string().trim().optional().nullable(),
  enderecoCidade: z.string().trim().optional().nullable(),
  enderecoEstado: z
    .string()
    .max(2, 'Estado deve ter no máximo 2 caracteres')
    .trim()
    .optional()
    .nullable(),
});

export class CreateOrderDto extends createZodDto(CreateOrderSchema) {}
