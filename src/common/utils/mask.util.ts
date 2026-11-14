/**
 * Mascara um e-mail para exibição ("ma***@gmail.com"), mantendo só o começo do
 * usuário e o domínio — o suficiente para a equipe confirmar com a cliente
 * qual endereço recebeu a mensagem.
 */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const visible = user.length > 2 ? user.slice(0, 2) : user.slice(0, 1);
  return `${visible}***@${domain}`;
}
