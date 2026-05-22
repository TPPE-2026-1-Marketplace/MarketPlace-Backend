/**
 * Resultado do cálculo de frete retornado pelo ShippingService.
 */
export interface IShippingQuote {
  /** Valor do frete em reais */
  valor: number;

  /** Prazo estimado de entrega em dias úteis */
  prazo_dias: number;
}
