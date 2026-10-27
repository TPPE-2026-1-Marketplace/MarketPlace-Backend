import { createZodDto } from 'nestjs-zod';

import { CreateReviewSchema } from './create-review.dto';

/**
 * Schema Zod para a edição da própria avaliação pelo cliente.
 *
 * Mesmas regras de nota (1 a 5) e comentário (até 2000 caracteres) da criação,
 * ambos opcionais, mas ao menos um deve ser informado. O produto vem da rota.
 */
export const UpdateReviewSchema = CreateReviewSchema.pick({ nota: true, comentario: true })
  .partial()
  .refine((data) => data.nota !== undefined || data.comentario !== undefined, {
    message: 'Informe a nota e/ou o comentário a alterar',
  });

export class UpdateReviewDto extends createZodDto(UpdateReviewSchema) {}
