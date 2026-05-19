import { createZodDto } from 'nestjs-zod';
import { CreatePersonSchema } from './create-person.dto';

/**
 * Schema de atualização: todos os campos opcionais, exceto o CPF, que não
 * pode ser alterado (é a PK). O CPF vai pela URL no PATCH, não pelo body,
 * então é removido do schema do body.
 */
export const UpdatePersonSchema = CreatePersonSchema.omit({ cpf: true }).partial();

export class UpdatePersonDto extends createZodDto(UpdatePersonSchema) {}
