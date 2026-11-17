// Timeouts (ms) da conexão SMTP. Sem eles, um servidor que não responde (ex.:
// porta bloqueada pelo provedor de hospedagem) prende a requisição por minutos.
export const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
export const SMTP_GREETING_TIMEOUT_MS = 10_000;
export const SMTP_SOCKET_TIMEOUT_MS = 20_000;

// Porta SMTP com TLS implícito (smtps). Nas demais (587, 25) o TLS vem via STARTTLS.
export const SMTP_IMPLICIT_TLS_PORT = 465;
export const SMTP_DEFAULT_PORT = 587;

// Timeout (ms) das chamadas HTTPS à API do Gmail (token OAuth2 e envio).
export const GMAIL_API_TIMEOUT_MS = 10_000;
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GMAIL_API_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// Renova o access_token do Gmail 1 min antes de expirar.
export const GMAIL_TOKEN_REFRESH_BUFFER_MS = 60_000;
export const MS_PER_SECOND = 1_000;

// Nome de exibição do remetente quando MAIL_FROM não é definido.
export const MAIL_DEFAULT_SENDER_NAME = 'DK Fashion';
