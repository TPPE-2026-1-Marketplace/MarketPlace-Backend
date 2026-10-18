import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { RegisterPersonSchema } from './register-person.dto';
import { PhoneSchema } from '../../common/dtos';

/**
 * Schema de atualização: baseado no RegisterPersonSchema, com todos os campos
 * opcionais e sem CPF no body (CPF permanece na URL por ser a PK).
 *
 * `senha` é permitida apenas no update para suportar alteração de credencial.
 * `telefone` aceita `null` para o usuário poder remover o telefone cadastrado.
 */
export const UpdatePersonSchema = RegisterPersonSchema.omit({ cpf: true })
  .extend({
    senha: z.string().min(8).max(72).optional(),
    telefone: PhoneSchema.nullable(),
  })
  .partial();

export class UpdatePersonDto extends createZodDto(UpdatePersonSchema) {}
