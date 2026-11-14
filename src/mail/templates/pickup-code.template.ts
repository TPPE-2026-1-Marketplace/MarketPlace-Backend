import type { MailMessage } from '../interfaces/mail-message.interface';

export interface PickupCodeEmailData {
  to: string;
  /** Nome da cliente; sem nome, a saudação fica genérica. */
  nome?: string | null;
  idPedido: number;
  codigo: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Só o primeiro nome, como no restante da comunicação da loja. */
function firstName(nome?: string | null): string | null {
  const first = nome?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/**
 * E-mail com o código de 6 dígitos que a cliente apresenta no balcão para
 * retirar o pedido na loja física (issue #247).
 */
export function buildPickupCodeEmail({
  to,
  nome,
  idPedido,
  codigo,
}: PickupCodeEmailData): MailMessage {
  const name = firstName(nome);
  const greeting = name ? `Olá, ${name}!` : 'Olá!';
  const subject = `Código de retirada do pedido #${idPedido} — DK Fashion`;

  const text = [
    greeting,
    '',
    `Seu pedido #${idPedido} está pago e aguardando retirada na loja DK Fashion.`,
    '',
    `Código de retirada: ${codigo}`,
    '',
    'Apresente este código no balcão para receber o pedido. Não compartilhe com',
    'ninguém: a equipe da loja nunca pede o código por telefone ou mensagem.',
    '',
    'Se você não fez este pedido, ignore este e-mail.',
    '',
    'DK Fashion',
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f6f3f1;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a6f64;">DK Fashion</p>
      <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(greeting)}</h1>
      <p style="margin:0 0 24px;line-height:1.5;">Seu pedido <strong>#${idPedido}</strong> está pago e aguardando retirada na loja.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#6b6b6b;">Código de retirada</p>
      <p style="margin:0 0 24px;font-size:32px;font-weight:bold;letter-spacing:8px;">${escapeHtml(codigo)}</p>
      <p style="margin:0 0 12px;line-height:1.5;font-size:14px;">Apresente este código no balcão para receber o pedido. Não compartilhe com ninguém: a equipe da loja nunca pede o código por telefone ou mensagem.</p>
      <p style="margin:0;line-height:1.5;font-size:12px;color:#8a8a8a;">Se você não fez este pedido, ignore este e-mail.</p>
    </div>
  </body>
</html>`;

  return { to, subject, text, html };
}
