import { CreatePaymentSchema } from './create-payment.dto';
import { CaptureMethod } from '../entities/payment.entity';

describe('CreatePaymentSchema', () => {
  it('aplica default de 1 parcela quando installments não é informado', () => {
    const result = CreatePaymentSchema.parse({
      idPedido: 1,
      captureMethod: CaptureMethod.PIX,
    });
    expect(result.installments).toBe(1);
  });

  it.each([
    [CaptureMethod.PIX, 1, true],
    [CaptureMethod.PIX, 2, false],
    [CaptureMethod.DEBIT_CARD, 1, true],
    [CaptureMethod.DEBIT_CARD, 3, false],
    [CaptureMethod.CREDIT_CARD, 1, true],
    [CaptureMethod.CREDIT_CARD, 6, true],
    [CaptureMethod.CREDIT_CARD, 12, true],
    [CaptureMethod.CREDIT_CARD, 13, false],
    [CaptureMethod.CREDIT_CARD, 0, false],
  ])('captureMethod=%s com installments=%i => válido=%s', (captureMethod, installments, valid) => {
    const parse = () => CreatePaymentSchema.parse({ idPedido: 1, captureMethod, installments });
    if (valid) {
      expect(parse).not.toThrow();
    } else {
      expect(parse).toThrow();
    }
  });

  it.each([
    [0, false],
    [-1, false],
    [1.5, false],
    [1, true],
    [99, true],
  ])('idPedido=%p => válido=%s', (idPedido, valid) => {
    const parse = () =>
      CreatePaymentSchema.parse({ idPedido, captureMethod: CaptureMethod.PIX, installments: 1 });
    if (valid) {
      expect(parse).not.toThrow();
    } else {
      expect(parse).toThrow();
    }
  });

  it('rejeita captureMethod fora do enum', () => {
    expect(() =>
      CreatePaymentSchema.parse({ idPedido: 1, captureMethod: 'boleto', installments: 1 }),
    ).toThrow();
  });
});
