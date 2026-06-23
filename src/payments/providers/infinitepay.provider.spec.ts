import axios from 'axios';

import { InfinitePayProvider } from './infinitepay.provider';
import { CaptureMethod, PaymentStatus } from '../entities/payment.entity';

import type { Order } from '../../orders/entities/order.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const orderComItens = {
  idPedido: 42,
  valorFrete: 15,
  items: [{ idVariante: 'SKU-1', precoUnitario: 10, quantidade: 2 }],
} as unknown as Order;

describe('InfinitePayProvider', () => {
  let provider: InfinitePayProvider;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, INFINITEPAY_HANDLE: 'loja-teste' };
    provider = new InfinitePayProvider();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('cria o checkout e retorna PENDING com o payment_link do gateway', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { id: 'abc', payment_link: 'https://pay/abc' },
    });

    const result = await provider.charge(100, CaptureMethod.CREDIT_CARD, 1, orderComItens);

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.orderNsu).toBe('42');
    expect(result.redirectUrl).toBe('https://pay/abc');
    const [endpoint, payload] = mockedAxios.post.mock.calls[0];
    expect(endpoint).toContain('infinitepay.io');
    expect(payload).toMatchObject({ handle: 'loja-teste', order_nsu: '42' });
    expect((payload as { items: unknown[] }).items).toHaveLength(2);
    expect((payload as { items: { name: string; price: number }[] }).items[1]).toMatchObject({
      name: 'Frete',
      price: 1500,
    });
  });

  it('envia dados do cliente, endereço e redirect_url com o id do pedido', async () => {
    process.env.INFINITEPAY_REDIRECT_URL = 'https://loja.test/pedido/{orderId}';
    mockedAxios.post.mockResolvedValueOnce({
      data: { id: 'abc', payment_link: 'https://pay/abc' },
    });

    const order = {
      ...orderComItens,
      clienteNomeAvulso: 'Maria Silva',
      clienteEmailAvulso: 'maria@example.com',
      clienteTelefone: '(61) 99999-1111',
      enderecoCep: '70000-000',
      enderecoRua: 'Rua Central',
      enderecoBairro: 'Centro',
      enderecoNumero: '123',
      enderecoComplemento: 'Sala 4',
    } as unknown as Order;

    await provider.charge(100, CaptureMethod.PIX, 1, order);

    const [, payload] = mockedAxios.post.mock.calls[0];
    expect(payload).toMatchObject({
      redirect_url: 'https://loja.test/pedido/42',
      customer: {
        name: 'Maria Silva',
        email: 'maria@example.com',
        phone_number: '+5561999991111',
      },
      address: {
        cep: '70000000',
        street: 'Rua Central',
        neighborhood: 'Centro',
        number: '123',
        complement: 'Sala 4',
      },
    });
  });

  it.each([
    [{ payment_link: 'https://pay/link', url: 'https://pay/url', id: 'x' }, 'https://pay/link'],
    [{ url: 'https://pay/url', id: 'x' }, 'https://pay/url'],
    [{ id: 'zzz' }, 'https://checkout.infinitepay.io/l/zzz'],
  ])(
    'resolve o redirectUrl pela precedência payment_link > url > id (%#)',
    async (data, esperado) => {
      mockedAxios.post.mockResolvedValueOnce({ data });
      const result = await provider.charge(50, CaptureMethod.PIX, 1);
      expect(result.redirectUrl).toBe(esperado);
    },
  );

  it('usa item genérico quando o pedido não tem itens', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 'gen' } });

    await provider.charge(99.9, CaptureMethod.PIX, 1);

    const [, payload] = mockedAxios.post.mock.calls[0];
    const items = (payload as { items: { price: number; quantity: number }[] }).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ price: 9990, quantity: 1 });
  });

  it('lança erro de gateway com a mensagem do axios quando o POST falha', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { message: 'handle inválido' } },
    });
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(provider.charge(100, CaptureMethod.CREDIT_CARD, 1, orderComItens)).rejects.toThrow(
      /InfinitePay: handle inválido/,
    );
  });
});
