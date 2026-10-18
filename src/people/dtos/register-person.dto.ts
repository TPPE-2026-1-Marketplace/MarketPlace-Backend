import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CpfSchema, PhoneSchema } from '../../common/dtos';

/**
 * Schema para registro de pessoa pelo caixa em `/api/people/register`.
 *
 * Fluxo 1: Funcionário caixa registra uma pessoa na loja física.
 * - Email e nome: obrigatórios (dados básicos para identificação).
 * - CPF: obrigatório (chave primária e base da busca no módulo), com dígitos
 *   verificadores válidos.
 * - Telefone: opcional; se informado, precisa ser um telefone BR válido (com DDD).
 * - Sem senha: pessoa não faz login até completar auto-cadastro no site.
 * - Sem endereço: endereço é adicionado apenas no fluxo 2 (auto-cadastro).
 */
export const RegisterPersonSchema = z.object({
  email: z.email().max(160),
  nome: z.string().min(1).max(120),
  cpf: CpfSchema,
  telefone: PhoneSchema.optional(),
});

export class RegisterPersonDto extends createZodDto(RegisterPersonSchema) {}
