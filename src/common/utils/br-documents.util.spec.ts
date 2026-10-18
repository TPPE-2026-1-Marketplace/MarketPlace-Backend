import { isValidCpf, isValidPhone, onlyDigits } from './br-documents.util';

describe('onlyDigits', () => {
  it('remove tudo que não é dígito e tolera null/undefined', () => {
    expect(onlyDigits('(61) 99999-0000')).toBe('61999990000');
    expect(onlyDigits(null)).toBe('');
    expect(onlyDigits(undefined)).toBe('');
  });
});

describe('isValidCpf', () => {
  it.each(['52998224725', '11144477735', '529.982.247-25'])('aceita %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  it.each(['12345678900', '52998224724', '11111111111', '00000000000', '5299822472', '', null])(
    'rejeita %s',
    (cpf) => {
      expect(isValidCpf(cpf as string | null)).toBe(false);
    },
  );
});

describe('isValidPhone', () => {
  it.each(['61999990000', '(61) 99999-0000', '6133334444'])('aceita %s', (phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });

  it.each([
    ['DDD inexistente', '00999990000'],
    ['DDD 10', '10999990000'],
    ['celular sem 9', '61899990000'],
    ['fixo começando com 9', '6193334444'],
    ['fixo começando com 0', '6103334444'],
    ['curto demais', '619999900'],
    ['longo demais', '619999900001'],
    ['vazio', ''],
  ])('rejeita %s', (_label, phone) => {
    expect(isValidPhone(phone)).toBe(false);
  });
});
