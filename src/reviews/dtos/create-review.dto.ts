import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Schema Zod para validação da criação de avaliação pelo corpo da requisição.
 *
 * O `id_cliente` não deve vir no payload (corpo), pois será capturado do token JWT.
 *
 * idProduto: ID numérico inteiro positivo do produto.
 * nota: Nota inteira entre 1 e 5 (equivalente a @IsInt() @Min(1) @Max(5)).
 * comentario: Comentário opcional de até 2000 caracteres (equivalente a @MaxLength(2000)).
 */
export const CreateReviewSchema = z.object({
  idProduto: z
    .number()
    .int()
    .positive('O ID do produto deve ser um número inteiro positivo'),
  nota: z
    .number()
    .int()
    .min(1, 'A nota deve ser no mínimo 1')
    .max(5, 'A nota deve ser no máximo 5'),
  comentario: z
    .string()
    .max(2000, 'O comentário pode ter no máximo 2000 caracteres')
    .optional(),
});

export class CreateReviewDto extends createZodDto(CreateReviewSchema) {}

/**
 * Schema Zod para paginação das avaliações do produto.
 * O default de itens por página é 10 (conforme requisitos da US07).
 */
export const QueryPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export class QueryPaginationDto extends createZodDto(QueryPaginationSchema) {}
