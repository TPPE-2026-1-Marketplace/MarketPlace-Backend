import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CaptureMethod } from '../entities/payment.entity';

export const CreatePaymentSchema = z
  .object({
    idPedido: z
      .number()
      .int('O ID do pedido deve ser um número inteiro')
      .positive('O ID do pedido deve ser maior que zero'),
    captureMethod: z.nativeEnum(CaptureMethod),
    installments: z
      .number()
      .int('O número de parcelas deve ser um número inteiro')
      .min(1, 'O número de parcelas deve ser pelo menos 1')
      .max(12, 'O número de parcelas máximo é 12')
      .default(1),
  })
  .refine(
    (data) => {
      if (
        (data.captureMethod === CaptureMethod.PIX ||
          data.captureMethod === CaptureMethod.DEBIT_CARD) &&
        data.installments > 1
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Métodos Pix e Cartão de Débito permitem apenas 1 parcela.',
      path: ['installments'],
    },
  );

export class CreatePaymentDto extends createZodDto(CreatePaymentSchema) {}
