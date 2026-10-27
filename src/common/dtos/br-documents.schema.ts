import { z } from 'zod';

import { isValidCpf, isValidPhone, onlyDigits } from '../utils/br-documents.util';

/**
 * CPF: exatamente 11 dígitos, sem máscara (é a PK de `person`), com dígitos
 * verificadores corretos. O `abort` evita duas mensagens para o mesmo campo
 * quando o formato já está errado.
 */
export const CpfSchema = z
  .string()
  .regex(/^\d{11}$/, { error: 'CPF deve conter exatamente 11 dígitos numéricos', abort: true })
  .refine(isValidCpf, { error: 'CPF inválido' });

/**
 * Telefone brasileiro com DDD (10 ou 11 dígitos).
 *
 * Aceita máscara na entrada (`(61) 99999-0000`) e SEMPRE persiste só dígitos —
 * o checkout do front envia o telefone mascarado.
 */
export const PhoneSchema = z
  .string()
  .transform(onlyDigits)
  .pipe(z.string().refine(isValidPhone, { error: 'Telefone inválido. Informe DDD + número.' }));
