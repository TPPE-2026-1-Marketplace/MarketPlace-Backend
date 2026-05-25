import { CreateCouponSchema } from './create-coupon.dto';

const baseCoupon = {
  numeroDoCupom: 'PROMO10',
  tipoCupom: 'fixo' as const,
  valorDesconto: 10,
  dataInicio: '2026-01-01T00:00:00Z',
  dataFim: '2026-12-31T00:00:00Z',
};

describe('CreateCouponSchema', () => {
  it('aceita datas como string ISO 8601 (z.iso.datetime)', () => {
    expect(() => CreateCouponSchema.parse(baseCoupon)).not.toThrow();
  });

  it('normaliza o número do cupom para maiúsculas e sem espaços', () => {
    const result = CreateCouponSchema.parse({ ...baseCoupon, numeroDoCupom: '  promo10 ' });
    expect(result.numeroDoCupom).toBe('PROMO10');
  });

  // Regressão: o campo deve ser string ISO, não objeto Date — um Date falha na validação,
  // que é exatamente o bug que tínhamos com z.date() (o corpo JSON chega como string).
  it('rejeita objeto Date em dataInicio/dataFim', () => {
    expect(() =>
      CreateCouponSchema.parse({
        ...baseCoupon,
        dataInicio: new Date('2026-01-01') as unknown as string,
      }),
    ).toThrow();
  });

  it.each(['2026-13-01T00:00:00Z', 'ontem', '01/01/2026', ''])(
    'rejeita data inválida (%s)',
    (dataInicio) => {
      expect(() => CreateCouponSchema.parse({ ...baseCoupon, dataInicio })).toThrow();
    },
  );

  it('rejeita quando dataFim não é posterior a dataInicio', () => {
    expect(() =>
      CreateCouponSchema.parse({
        ...baseCoupon,
        dataInicio: '2026-12-31T00:00:00Z',
        dataFim: '2026-01-01T00:00:00Z',
      }),
    ).toThrow(/posterior/);
  });

  it('rejeita cupom de porcentagem com desconto acima de 100%', () => {
    expect(() =>
      CreateCouponSchema.parse({ ...baseCoupon, tipoCupom: 'porcentagem', valorDesconto: 150 }),
    ).toThrow(/100%/);
  });

  it('aceita cupom de porcentagem com desconto até 100%', () => {
    expect(() =>
      CreateCouponSchema.parse({ ...baseCoupon, tipoCupom: 'porcentagem', valorDesconto: 100 }),
    ).not.toThrow();
  });
});
