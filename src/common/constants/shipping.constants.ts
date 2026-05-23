// Timeout máximo (ms) para chamadas à API dos Correios.
export const CORREIOS_TIMEOUT_MS = 5_000;

// TTL do cache em memória do ShippingService: 30 minutos em ms.
export const SHIPPING_CACHE_TTL_MS = 1_800_000;

// Limite de entradas no cache antes de disparar eviction.
// Evita crescimento ilimitado de memória em cenários de alto tráfego.
export const SHIPPING_CACHE_MAX_ENTRIES = 500;

// Endpoint público do calculador de preços e prazos dos Correios.
export const CORREIOS_CALC_URL = 'http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx';

// Código do serviço PAC (sem contrato) na API CalcPrecoPrazo.
export const CORREIOS_SERVICO_PAC = '04510';

// Valores padrão de pacote usados quando peso/dimensões não são informados.
// Correspondem aos mínimos aceitos pela API dos Correios (formato caixa).
export const SHIPPING_PACKAGE_DEFAULTS = {
  peso: 0.3, // kg
  comprimento: 16, // cm
  largura: 11, // cm
  altura: 2, // cm
} as const;
