import { CpfSchema, PhoneSchema } from './br-documents.schema';

describe('CpfSchema', () => {
  it('aceita CPF válido sem máscara', () => {
    expect(CpfSchema.parse('52998224725')).toBe('52998224725');
  });

  it('rejeita CPF com máscara (a PK é sempre só dígitos)', () => {
    expect(CpfSchema.safeParse('529.982.247-25').success).toBe(false);
  });

  it('diferencia formato errado de dígito verificador errado, com uma mensagem só', () => {
    const formato = CpfSchema.safeParse('123');
    expect(formato.success).toBe(false);
    expect(formato.error?.issues).toHaveLength(1);
    expect(formato.error?.issues[0].message).toBe(
      'CPF deve conter exatamente 11 dígitos numéricos',
    );

    const digito = CpfSchema.safeParse('12345678900');
    expect(digito.error?.issues).toHaveLength(1);
    expect(digito.error?.issues[0].message).toBe('CPF inválido');
  });

  it('rejeita sequência repetida e letras', () => {
    expect(CpfSchema.safeParse('11111111111').success).toBe(false);
    expect(CpfSchema.safeParse('abcdefghijk').success).toBe(false);
  });
});

describe('PhoneSchema', () => {
  it('normaliza telefone mascarado para só dígitos', () => {
    expect(PhoneSchema.parse('(61) 99999-0000')).toBe('61999990000');
    expect(PhoneSchema.parse('(61) 3333-4444')).toBe('6133334444');
  });

  it('aceita telefone já normalizado', () => {
    expect(PhoneSchema.parse('61999990000')).toBe('61999990000');
  });

  it('rejeita DDD inexistente, tamanho errado e string vazia', () => {
    expect(PhoneSchema.safeParse('(00) 99999-0000').success).toBe(false);
    expect(PhoneSchema.safeParse('6199999').success).toBe(false);
    expect(PhoneSchema.safeParse('').success).toBe(false);
  });
});
