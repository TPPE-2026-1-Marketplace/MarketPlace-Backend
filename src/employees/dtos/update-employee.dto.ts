import { createZodDto } from 'nestjs-zod';
import { CreateEmployeeSchema } from './create-employee.dto';

export const UpdateEmployeeSchema = CreateEmployeeSchema.omit({ cpf: true }).partial();

export class UpdateEmployeeDto extends createZodDto(UpdateEmployeeSchema) { }