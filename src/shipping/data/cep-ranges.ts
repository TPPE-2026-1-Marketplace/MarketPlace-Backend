export interface CepRange {
  start: number;
  end: number;
  region: string;
  valor: number;
  prazo_dias: number;
}

export const CEP_RANGES: readonly CepRange[] = [
  {
    start: 1_000_000,
    end: 39_999_999,
    region: 'Sudeste (SP/RJ/MG/ES)',
    valor: 22.0,
    prazo_dias: 5,
  },
  {
    start: 40_000_000,
    end: 65_999_999,
    region: 'Nordeste',
    valor: 30.0,
    prazo_dias: 8,
  },
  {
    start: 66_000_000,
    end: 69_999_999,
    region: 'Norte (PA/AP/AM/RR/AC)',
    valor: 38.0,
    prazo_dias: 12,
  },
  {
    start: 70_000_000,
    end: 76_799_999,
    region: 'Centro-Oeste (DF/GO) — origem',
    valor: 15.0,
    prazo_dias: 2,
  },
  {
    start: 76_800_000,
    end: 79_999_999,
    region: 'RO/TO/MT/MS',
    valor: 28.0,
    prazo_dias: 8,
  },
  {
    start: 80_000_000,
    end: 99_999_999,
    region: 'Sul (PR/SC/RS)',
    valor: 25.0,
    prazo_dias: 6,
  },
];
