import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CreateOrderItemSchema } from './create-order.dto';

export const CreateInStoreOrderSchema = z.object({
  // Pode ser de cliente já cadastrado (qualquer CPF salvo no banco), por isso aqui só
  // o formato; a validade dos dígitos é checada no service quando o CPF é novo (avulso).
  idUsuario: z
    .string()
    .regex(/^\d{11}$/, 'O CPF do cliente deve conter exatamente 11 dígitos numéricos')
    .optional()
    .nullable(),
  codigoVendedor: z
    .string()
    .max(20, 'O código do vendedor deve ter no máximo 20 caracteres')
    .trim(),
  items: z.array(CreateOrderItemSchema).min(1, 'A venda deve conter ao menos um item'),
  couponNumero: z.string().toUpperCase().trim().optional().nullable(),
  clienteNomeAvulso: z.string().trim().optional().nullable(),
});

export class CreateInStoreOrderDto extends createZodDto(CreateInStoreOrderSchema) {}
