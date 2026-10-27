import { createZodDto } from 'nestjs-zod';

import { CreateEmployeeSchema } from './create-employee.dto';
import { PhoneSchema } from '../../common/dtos';

// `telefone` aceita `null` para permitir remover o telefone cadastrado.
export const UpdateEmployeeSchema = CreateEmployeeSchema.omit({ cpf: true })
  .extend({ telefone: PhoneSchema.nullable() })
  .partial();

export class UpdateEmployeeDto extends createZodDto(UpdateEmployeeSchema) {}
