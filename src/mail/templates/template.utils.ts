const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto vindo do usuário antes de entrar no HTML do e-mail. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Só o primeiro nome, como no restante da comunicação da loja. */
export function firstName(nome?: string | null): string | null {
  return nome?.trim().split(/\s+/)[0] || null;
}
