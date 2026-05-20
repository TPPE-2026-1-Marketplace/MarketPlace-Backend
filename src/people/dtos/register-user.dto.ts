import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Schema para auto-cadastro de usuário em `/api/people/register-user`.
 *
 * Fluxo 2: Pessoa registra-se pelo site.
 * - Email e senha: obrigatórios (credenciais para login).
 * - CPF: pode já existir do fluxo 1 (caixa), ou é novo.
 * - Nome e telefone: opcionais (preenchimento gradual).
 * - Endereço(s): opcionais no payload, persistem em tabela separada.
 *
 * Se CPF já existe no banco (via fluxo 1), o service atualiza Person com senha.
 * Se CPF não existe, cria Person nova + Address opcional.
 */
export const RegisterUserSchema = z.object({
    email: z.string().email().max(160),
    senha: z.string().min(8).max(72),
    cpf: z
        .string()
        .regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos numéricos')
        .optional(),
    nome: z.string().min(1).max(120).optional(),
    telefone: z.string().max(20).optional(),
    endereco: z
        .object({
            cep: z.string().max(9),
            logradouro: z.string().max(255),
            numero: z.string().max(20),
            complemento: z.string().max(255).optional(),
            bairro: z.string().max(100),
            cidade: z.string().max(100),
            uf: z.string().length(2),
        })
        .optional(),
});

export class RegisterUserDto extends createZodDto(RegisterUserSchema) { }
