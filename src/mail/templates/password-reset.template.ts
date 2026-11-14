import { escapeHtml, firstName } from './template.utils';

import type { MailMessage } from '../interfaces/mail-message.interface';

export interface PasswordResetEmailData {
  to: string;
  nome?: string | null;
  /** Link completo da tela de redefinição, já com o token. */
  link: string;
  validadeMinutos: number;
}

/** E-mail com o link de redefinição de senha (issue #250). */
export function buildPasswordResetEmail({
  to,
  nome,
  link,
  validadeMinutos,
}: PasswordResetEmailData): MailMessage {
  const name = firstName(nome);
  const greeting = name ? `Olá, ${name}!` : 'Olá!';
  const subject = 'Redefinição de senha — DK Fashion';

  const text = [
    greeting,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta DK Fashion.',
    'Para criar uma nova senha, acesse o link abaixo:',
    '',
    link,
    '',
    `O link vale por ${validadeMinutos} minutos e só pode ser usado uma vez.`,
    '',
    'Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma.',
    '',
    'DK Fashion',
  ].join('\n');

  const safeLink = escapeHtml(link);
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f6f3f1;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a6f64;">DK Fashion</p>
      <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(greeting)}</h1>
      <p style="margin:0 0 24px;line-height:1.5;">Recebemos um pedido para redefinir a senha da sua conta. Para criar uma nova senha, clique no botão abaixo.</p>
      <p style="margin:0 0 24px;"><a href="${safeLink}" style="display:inline-block;background:#C8427C;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">Redefinir senha</a></p>
      <p style="margin:0 0 12px;line-height:1.5;font-size:14px;">O link vale por ${validadeMinutos} minutos e só pode ser usado uma vez. Se o botão não funcionar, copie e cole no navegador:</p>
      <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#6b6b6b;">${safeLink}</p>
      <p style="margin:0;line-height:1.5;font-size:12px;color:#8a8a8a;">Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma.</p>
    </div>
  </body>
</html>`;

  return { to, subject, text, html };
}
