import { CreateInStoreOrderSchema } from './create-in-store-order.dto';
import { CreateOrderSchema } from './create-order.dto';

const items = [{ variantSku: 'SKU-1', quantidade: 1 }];

describe('CreateOrderSchema (CPF e telefone do convidado)', () => {
  it('aceita CPF válido e normaliza o telefone mascarado que o checkout envia', () => {
    const result = CreateOrderSchema.parse({
      items,
      clienteCpfAvulso: '11144477735',
      clienteTelefone: '(61) 99999-0000',
    });
    expect(result.clienteTelefone).toBe('61999990000');
  });

  it('CPF e telefone seguem opcionais e aceitam null', () => {
    const result = CreateOrderSchema.parse({
      items,
      clienteCpfAvulso: null,
      clienteTelefone: null,
    });
    expect(result.clienteCpfAvulso).toBeNull();
    expect(result.clienteTelefone).toBeNull();
  });

  it('rejeita CPF com dígito verificador errado e telefone inválido', () => {
    expect(CreateOrderSchema.safeParse({ items, clienteCpfAvulso: '12345678900' }).success).toBe(
      false,
    );
    expect(CreateOrderSchema.safeParse({ items, clienteTelefone: '(00) 99999-0000' }).success).toBe(
      false,
    );
  });
});

describe('CreateInStoreOrderSchema (idUsuario)', () => {
  const base = { codigoVendedor: 'ANA01', items };

  it('aceita 11 dígitos sem exigir dígito verificador (cliente pode já estar cadastrado)', () => {
    expect(CreateInStoreOrderSchema.safeParse({ ...base, idUsuario: '12345678900' }).success).toBe(
      true,
    );
  });

  it('rejeita 11 caracteres que não são todos dígitos (antes passava)', () => {
    expect(CreateInStoreOrderSchema.safeParse({ ...base, idUsuario: 'abcdefghijk' }).success).toBe(
      false,
    );
  });

  it('idUsuario segue opcional e aceita null', () => {
    expect(CreateInStoreOrderSchema.safeParse(base).success).toBe(true);
    expect(CreateInStoreOrderSchema.safeParse({ ...base, idUsuario: null }).success).toBe(true);
  });
});
