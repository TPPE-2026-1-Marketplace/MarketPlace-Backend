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

// Limite máximo de desconto para cupons do tipo porcentagem (100%).
export const PERCENTAGE_MAX = 100;

// Centavos por unidade monetária — gateways de pagamento (InfinitePay) trabalham
// em centavos; usado para converter reais <-> centavos.
export const CENTS_PER_CURRENCY_UNIT = 100;

// Tamanho máximo aceito no upload de imagem (5 MB).
export const MAX_IMAGE_UPLOAD_BYTES = 5_242_880;

// Limites usados para gerar código de verificação de 6 dígitos na retirada em loja.
export const VERIFICATION_CODE_MIN = 100000;
export const VERIFICATION_CODE_RANGE = 900000;
