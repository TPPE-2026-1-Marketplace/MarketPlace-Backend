import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const InfinitePayWebhookSchema = z.object({
  event: z.string().optional(),
  invoice_slug: z.string(),
  amount: z.number().int().positive(),
  paid_amount: z.number().int().nonnegative().optional().nullable(),
  installments: z.number().int().positive().optional().nullable(),
  capture_method: z.string().optional().nullable(),
  transaction_nsu: z.string().optional().nullable(),
  order_nsu: z.string(),
  receipt_url: z.url().optional().nullable(),
  status: z.string().optional(),
});

export class InfinitePayWebhookDto extends createZodDto(InfinitePayWebhookSchema) {}
