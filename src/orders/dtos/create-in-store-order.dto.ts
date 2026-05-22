import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CreateOrderItemSchema } from './create-order.dto';

export const CreateInStoreOrderSchema = z.object({
  idUsuario: z
    .string()
    .length(11, 'O CPF do cliente deve conter exatamente 11 caracteres')
    .optional()
    .nullable(),
  idFuncionario: z
    .string()
    .length(11, 'O CPF do vendedor deve conter exatamente 11 caracteres')
    .trim(),
  items: z
    .array(CreateOrderItemSchema)
    .min(1, 'A venda deve conter ao menos um item'),
  couponNumero: z
    .string()
    .toUpperCase()
    .trim()
    .optional()
    .nullable(),
});

export class CreateInStoreOrderDto extends createZodDto(CreateInStoreOrderSchema) {}
