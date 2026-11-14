import { buildPasswordResetEmail } from './password-reset.template';

describe('buildPasswordResetEmail', () => {
  const base = {
    to: 'maria@cliente.com',
    link: 'https://dkfashion.onrender.com/redefinir-senha?token=abc_123-XYZ',
    validadeMinutos: 30,
  };

  it('monta assunto, texto e HTML com o link e a validade', () => {
    const email = buildPasswordResetEmail({ ...base, nome: 'Maria Clara' });

    expect(email.subject).toBe('Redefinição de senha — DK Fashion');
    expect(email.text).toContain('Olá, Maria!');
    expect(email.text).toContain(base.link);
    expect(email.text).toContain('30 minutos');
    expect(email.html).toContain(`href="${base.link}"`);
  });

  it('escapa nome e link no HTML', () => {
    const email = buildPasswordResetEmail({
      ...base,
      nome: '<b>x</b>',
      link: 'https://a.b/r?token=1&x="y"',
    });
    expect(email.html).not.toContain('<b>x</b>');
    expect(email.html).toContain('token=1&amp;x=&quot;y&quot;');
  });
});
