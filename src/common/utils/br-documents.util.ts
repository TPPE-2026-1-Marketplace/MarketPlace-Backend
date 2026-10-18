/**
 * Validação de documentos e contatos brasileiros (CPF e telefone).
 *
 * Funções puras, sem dependência do Nest. Usadas pelos schemas Zod
 * (`common/dtos/br-documents.schema.ts`) e por services que recebem CPF de
 * fora do fluxo de DTO.
 */

// DDDs em uso no Brasil (ANATEL). DDD inexistente indica erro de digitação.
const VALID_DDDS = new Set(
  `11 12 13 14 15 16 17 18 19  21 22 24 27 28  31 32 33 34 35 37 38
   41 42 43 44 45 46 47 48 49  51 53 54 55  61 62 63 64 65 66 67 68 69
   71 73 74 75 77 79  81 82 83 84 85 86 87 88 89  91 92 93 94 95 96 97 98 99`.split(/\s+/),
);

const CPF_LENGTH = 11;
const CPF_FIRST_CHECK_POSITION = 9;
const CPF_SECOND_CHECK_POSITION = 10;
const CPF_MOD = 11;
const CPF_SCALE = 10;
const PHONE_LANDLINE_LENGTH = 10;
const PHONE_MOBILE_LENGTH = 11;
const PHONE_DDD_LENGTH = 2;

export const onlyDigits = (value: string | null | undefined): string =>
  (value ?? '').replace(/\D/g, '');

function cpfCheckDigit(digits: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += Number(digits[i]) * (length + 1 - i);
  }
  return ((sum * CPF_SCALE) % CPF_MOD) % CPF_SCALE;
}

/** CPF com 11 dígitos, dígitos verificadores corretos e sem sequência repetida. */
export function isValidCpf(value: string | null | undefined): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== CPF_LENGTH) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // 111.111.111-11 etc.
  return (
    cpfCheckDigit(digits, CPF_FIRST_CHECK_POSITION) === Number(digits[CPF_FIRST_CHECK_POSITION]) &&
    cpfCheckDigit(digits, CPF_SECOND_CHECK_POSITION) === Number(digits[CPF_SECOND_CHECK_POSITION])
  );
}

/**
 * Telefone brasileiro com DDD:
 * - celular: 11 dígitos, DDD válido e 9 logo após o DDD;
 * - fixo: 10 dígitos, DDD válido e primeiro dígito entre 2 e 5.
 */
export function isValidPhone(value: string | null | undefined): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== PHONE_LANDLINE_LENGTH && digits.length !== PHONE_MOBILE_LENGTH) {
    return false;
  }
  if (!VALID_DDDS.has(digits.slice(0, PHONE_DDD_LENGTH))) return false;
  const first = digits[PHONE_DDD_LENGTH];
  return digits.length === PHONE_MOBILE_LENGTH ? first === '9' : /[2-5]/.test(first);
}
