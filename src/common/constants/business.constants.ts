// Taxa de comissão padrão de funcionários (2,5%). Usado quando o
// `taxa_comissao` não vem no payload de criação.
export const EMPLOYEE_DEFAULT_COMMISSION_RATE = 0.025;

// Bytes aleatórios usados pra gerar senha temporária quando o admin cadastra
// um funcionário. 4 bytes geram 8 caracteres hex (suficiente pra primeiro login).
export const TEMP_PASSWORD_BYTES = 4;

// Porta padrão da API quando PORT não está definido no ambiente.
export const DEFAULT_API_PORT = 3001;

// Porta padrão do Postgres (fallback quando POSTGRES_PORT não está no env).
export const DEFAULT_POSTGRES_PORT = 5432;
