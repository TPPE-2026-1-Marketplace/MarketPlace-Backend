export const BCRYPT_ROUNDS = 10;

// Recuperação de senha (#250): validade do link e tamanho do token aleatório.
export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const MS_PER_MINUTE = 60_000;
export const PASSWORD_RESET_TOKEN_TTL_MS = PASSWORD_RESET_TOKEN_TTL_MINUTES * MS_PER_MINUTE;
export const PASSWORD_RESET_TOKEN_BYTES = 32;
