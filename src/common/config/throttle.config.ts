const ONE_MINUTE_MS = 60_000;
const FIFTEEN_MINUTES_MS = 900_000;

export const THROTTLE_DEFAULT = { ttl: ONE_MINUTE_MS, limit: 60 };

export const THROTTLE_AUTH = { default: { ttl: FIFTEEN_MINUTES_MS, limit: 5 } };
// Esqueci minha senha / redefinição: mesmo limite do login (força bruta e spam de e-mail).
export const THROTTLE_PASSWORD_RESET = { default: { ttl: FIFTEEN_MINUTES_MS, limit: 5 } };
export const THROTTLE_REGISTER = { default: { ttl: FIFTEEN_MINUTES_MS, limit: 5 } };
export const THROTTLE_CHECKOUT = { default: { ttl: ONE_MINUTE_MS, limit: 10 } };
// Envio do código de retirada por e-mail: evita disparos repetidos (spam na caixa da cliente).
export const THROTTLE_PICKUP_CODE_EMAIL = { default: { ttl: ONE_MINUTE_MS, limit: 5 } };
