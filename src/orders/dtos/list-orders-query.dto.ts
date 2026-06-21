import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { OrderStatus, TipoRetirada } from '../entities/order.entity';

/**
 * Schema de query para listagem paginada de pedidos.
 * Usado tanto em GET /orders (admin/gerente) quanto em GET /orders/my (cliente).
 * Segue o padrão de paginação do projeto: page=1&limit=20, max limit=100.
 */
export const ListOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(OrderStatus, {
      message: `Status deve ser um de: ${Object.values(OrderStatus).join(', ')}`,
    })
    .optional(),
  tipoRetirada: z
    .enum(TipoRetirada, {
      message: `Tipo de retirada deve ser 'entrega' ou 'loja'`,
    })
    .optional(),
});

export class ListOrdersQueryDto extends createZodDto(ListOrdersQuerySchema) {}
