import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Schema para registro de pessoa pelo caixa em `/api/people/register`.
 *
 * Fluxo 1: Funcionário caixa registra uma pessoa na loja física.
 * - Email e nome: obrigatórios (dados básicos para identificação).
 * - CPF: obrigatório (chave primária e base da busca no módulo).
 * - Telefone: opcional.
 * - Sem senha: pessoa não faz login até completar auto-cadastro no site.
 * - Sem endereço: endereço é adicionado apenas no fluxo 2 (auto-cadastro).
 */
export const RegisterPersonSchema = z.object({
  email: z.string().email().max(160),
  nome: z.string().min(1).max(120),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos numéricos'),
  telefone: z.string().max(20).optional(),
});

export class RegisterPersonDto extends createZodDto(RegisterPersonSchema) { }