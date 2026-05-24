/**
 * Cotação retornada pela API Melhor Envio em `/api/v2/me/shipment/calculate`.
 *
 * A resposta é um array desses objetos, um por transportadora/serviço. Alguns
 * podem vir com `error` preenchido (ex: dimensões fora do limite da transportadora).
 *
 * `price` e `custom_price` vêm como string (ex: `"27.49"`) — sempre converter.
 * `custom_price`/`custom_delivery_time` são preenchidos mesmo quando o lojista
 * não customizou (vêm iguais a `price`/`delivery_time`), então usá-los direto
 * dá o "valor final pro cliente" sem precisar de coalescing.
 */
export interface IMelhorEnvioCotacao {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  discount?: string;
  currency?: string;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  custom_delivery_time?: number;
  custom_delivery_range?: { min: number; max: number };
  company: {
    id: number;
    name: string;
    picture?: string;
  };
  /** Quando este serviço falhou (ex: dimensões fora do limite), vem preenchido. */
  error?: string;
  /** Demais campos da resposta (packages, additional_services, etc.) — ignorados. */
  [key: string]: unknown;
}

/**
 * Resposta de sucesso do endpoint OAuth2 `/oauth/token`.
 */
export interface IMelhorEnvioTokenResponse {
  token_type: 'Bearer';
  expires_in: number;
  access_token: string;
  refresh_token?: string;
}
