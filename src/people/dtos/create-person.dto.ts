import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Schema Zod para criação de uma Person.
 *
 * Esta issue (#33) implementa apenas o CRUD básico do módulo. As regras
 * específicas dos endpoints de US02 (`/register` público) e US11 (cadastro
 * pelo caixa, sem senha) serão refinadas em D2, em DTOs próprios. Aqui o
 * DTO admite o caso geral: senha opcional, CPF/email obrigatórios.
 *
 * - CPF: 11 dígitos numéricos sem máscara (validação básica de formato; a
 *   validação de dígitos verificadores não está no escopo desta entrega).
 * - Email: formato válido, único no banco.
 * - Senha: opcional aqui, mas quando presente exige mínimo de 8 caracteres
 *   (alinhado com a US02).
 */
export const CreatePersonSchema = z.object({
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos numéricos'),
  nome: z.string().min(1).max(120),
  email: z.string().email().max(160),
  telefone: z.string().max(20).optional(),
  senha: z.string().min(8).max(72).optional(),
});

export class CreatePersonDto extends createZodDto(CreatePersonSchema) { }
