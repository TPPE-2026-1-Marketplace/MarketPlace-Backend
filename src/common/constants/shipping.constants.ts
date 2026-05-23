// Timeout máximo (ms) para chamadas HTTP ao provedor de frete.
export const MELHOR_ENVIO_TIMEOUT_MS = 5_000;

// TTL do cache em memória do ShippingService: 30 minutos em ms.
export const SHIPPING_CACHE_TTL_MS = 1_800_000;

// Limite de entradas no cache antes de disparar eviction.
// Evita crescimento ilimitado de memória em cenários de alto tráfego.
export const SHIPPING_CACHE_MAX_ENTRIES = 500;

// Path do endpoint de cálculo de frete da Melhor Envio.
export const MELHOR_ENVIO_CALC_PATH = '/api/v2/me/shipment/calculate';

// Path do endpoint OAuth2 de geração/renovação de token.
export const MELHOR_ENVIO_TOKEN_PATH = '/oauth/token';

// Janela de segurança antes da expiração do access_token (5 min em ms).
// Renovação preemptiva: se faltarem menos que esse buffer, refresh já dispara.
export const MELHOR_ENVIO_TOKEN_REFRESH_BUFFER_MS = 300_000;

// Valores padrão de pacote usados quando peso/dimensões não são informados.
// Caixa pequena padrão; valores aceitos pela Melhor Envio sem warning.
export const SHIPPING_PACKAGE_DEFAULTS = {
  peso: 0.3, // kg
  comprimento: 16, // cm
  largura: 11, // cm
  altura: 2, // cm
} as const;
