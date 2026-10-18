import { RegisterPersonSchema } from './register-person.dto';
import { RegisterUserSchema } from './register-user.dto';
import { UpdatePersonSchema } from './update-person.dto';

const person = { email: 'ana@dk.com', nome: 'Ana', cpf: '52998224725' };

describe('RegisterPersonSchema (CPF e telefone)', () => {
  it('aceita CPF válido e normaliza o telefone', () => {
    const result = RegisterPersonSchema.parse({ ...person, telefone: '(61) 99999-0000' });
    expect(result.telefone).toBe('61999990000');
  });

  it('telefone continua opcional', () => {
    expect(RegisterPersonSchema.parse(person).telefone).toBeUndefined();
  });

  it('rejeita CPF com dígito verificador errado', () => {
    expect(RegisterPersonSchema.safeParse({ ...person, cpf: '12345678900' }).success).toBe(false);
  });

  it('rejeita telefone inválido', () => {
    expect(RegisterPersonSchema.safeParse({ ...person, telefone: '(00) 99999-0000' }).success).toBe(
      false,
    );
  });
});

describe('RegisterUserSchema (CPF e telefone)', () => {
  const user = { email: 'ana@dk.com', senha: 'senha1234' };

  it('CPF segue opcional, mas se vier precisa ser válido', () => {
    expect(RegisterUserSchema.safeParse(user).success).toBe(true);
    expect(RegisterUserSchema.safeParse({ ...user, cpf: '52998224725' }).success).toBe(true);
    expect(RegisterUserSchema.safeParse({ ...user, cpf: '12345678900' }).success).toBe(false);
  });

  it('normaliza o telefone e rejeita inválido', () => {
    expect(RegisterUserSchema.parse({ ...user, telefone: '(61) 3333-4444' }).telefone).toBe(
      '6133334444',
    );
    expect(RegisterUserSchema.safeParse({ ...user, telefone: '123' }).success).toBe(false);
  });
});

describe('UpdatePersonSchema (telefone)', () => {
  it('aceita null para remover o telefone', () => {
    expect(UpdatePersonSchema.parse({ telefone: null }).telefone).toBeNull();
  });

  it('normaliza telefone mascarado e rejeita inválido', () => {
    expect(UpdatePersonSchema.parse({ telefone: '(61) 99999-0000' }).telefone).toBe('61999990000');
    expect(UpdatePersonSchema.safeParse({ telefone: '123' }).success).toBe(false);
  });

  it('não exige nenhum campo e ignora cpf no body (a PK fica na URL)', () => {
    expect(UpdatePersonSchema.parse({})).toEqual({});
    expect(UpdatePersonSchema.parse({ cpf: '52998224725' })).toEqual({});
  });
});
