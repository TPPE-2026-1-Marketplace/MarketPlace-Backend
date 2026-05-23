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
  tipoRetirada: z.nativeEnum(TipoRetirada).default(TipoRetirada.ENTREGA),
});

export class CreateOrderDto extends createZodDto(CreateOrderSchema) {}
