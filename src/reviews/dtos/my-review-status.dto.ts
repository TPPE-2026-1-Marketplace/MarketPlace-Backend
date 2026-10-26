export enum MotivoAvaliacao {
  PODE_AVALIAR = 'PODE_AVALIAR',
  JA_AVALIOU = 'JA_AVALIOU',
  SEM_COMPRA_VERIFICADA = 'SEM_COMPRA_VERIFICADA',
}

/**
 * Estado do cliente autenticado em relação à avaliação de um produto
 * (GET /api/reviews/product/:productId/mine).
 */
export interface MyReviewStatus {
  avaliacao: {
    idProduto: number;
    nota: number;
    comentario: string | null;
    dataAvaliacao: Date;
  } | null;
  podeAvaliar: boolean;
  motivo: MotivoAvaliacao;
}
