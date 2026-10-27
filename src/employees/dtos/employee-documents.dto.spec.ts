import { CreateEmployeeSchema } from './create-employee.dto';
import { UpdateEmployeeSchema } from './update-employee.dto';

const employee = {
  cpf: '52998224725',
  nome: 'Ana',
  email: 'ana@dk.com',
  role_perfil: 'vendedor',
};

describe('CreateEmployeeSchema (CPF e telefone)', () => {
  it('aceita CPF válido e normaliza o telefone', () => {
    const result = CreateEmployeeSchema.parse({ ...employee, telefone: '(61) 98888-7777' });
    expect(result.telefone).toBe('61988887777');
  });

  it('rejeita CPF com dígito verificador errado e telefone inválido', () => {
    expect(CreateEmployeeSchema.safeParse({ ...employee, cpf: '12345678900' }).success).toBe(false);
    expect(CreateEmployeeSchema.safeParse({ ...employee, telefone: '123' }).success).toBe(false);
  });
});

describe('UpdateEmployeeSchema (telefone)', () => {
  it('aceita null para remover o telefone e normaliza o resto', () => {
    expect(UpdateEmployeeSchema.parse({ telefone: null }).telefone).toBeNull();
    expect(UpdateEmployeeSchema.parse({ telefone: '(61) 98888-7777' }).telefone).toBe(
      '61988887777',
    );
  });

  it('rejeita telefone inválido e não aceita trocar o CPF', () => {
    expect(UpdateEmployeeSchema.safeParse({ telefone: '123' }).success).toBe(false);
    expect(UpdateEmployeeSchema.parse({ cpf: '52998224725' })).toEqual({});
  });
});
