import { buildPickupCodeEmail } from './pickup-code.template';

describe('buildPickupCodeEmail', () => {
  const base = { to: 'maria@cliente.com', idPedido: 1048, codigo: '482913' };

  it('monta assunto, texto e HTML com o pedido e o código', () => {
    const email = buildPickupCodeEmail({ ...base, nome: 'Maria Clara Souza' });

    expect(email.to).toBe('maria@cliente.com');
    expect(email.subject).toBe('Código de retirada do pedido #1048 — DK Fashion');
    expect(email.text).toContain('Olá, Maria!');
    expect(email.text).toContain('Código de retirada: 482913');
    expect(email.html).toContain('482913');
    expect(email.html).toContain('#1048');
  });

  it.each([null, undefined, '   '])('usa saudação genérica sem nome (%p)', (nome) => {
    expect(buildPickupCodeEmail({ ...base, nome }).text.startsWith('Olá!')).toBe(true);
  });

  it('escapa o nome no HTML', () => {
    const email = buildPickupCodeEmail({ ...base, nome: '<script>x</script>' });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });
});
