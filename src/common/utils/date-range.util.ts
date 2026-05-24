import { endOfMonth, startOfMonth } from 'date-fns';

/**
 * Retorna o intervalo [início, fim] de um mês/ano (1-12), em horário local.
 * `startDate` é o primeiro dia às 00:00:00.000 e `endDate` o último dia às 23:59:59.999.
 * Usado nos filtros de período de vendas, comissão e metas.
 */
export function getMonthDateRange(ano: number, mes: number): { startDate: Date; endDate: Date } {
  const reference = new Date(ano, mes - 1, 1);
  return { startDate: startOfMonth(reference), endDate: endOfMonth(reference) };
}
