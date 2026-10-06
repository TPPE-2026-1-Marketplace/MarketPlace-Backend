import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { Like } from 'typeorm';

import { AppModule } from '../app.module';
import { Person } from './entities/person.entity';
import { Address } from '../addresses/entities/address.entity';
import { Order, OrderStatus, TipoRetirada } from '../orders/entities/order.entity';

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

describe('DELETE /api/people/:cpf — anonimização LGPD (#197)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let peopleRepository: Repository<Person>;
  let ordersRepository: Repository<Order>;
  let addressRepository: Repository<Address>;
  let jwtService: JwtService;

  const cpf = '97197197197';
  const tokenOf = (sub: string) =>
    jwtService.sign({ sub, email: 'lgpd@example.com', role: 'cliente' });

  const createOrder = (status: OrderStatus) =>
    ordersRepository.save(
      ordersRepository.create({
        idUsuario: cpf,
        status,
        subtotal: 100,
        valorFrete: 20,
        valorTotal: 120,
        tipoRetirada: TipoRetirada.ENTREGA,
        clienteTelefone: '61999990000',
        enderecoCep: '70000-000',
        enderecoRua: 'Rua Pessoal',
        enderecoNumero: '42',
        enderecoComplemento: 'Apto 1',
        enderecoBairro: 'Asa Norte',
        enderecoCidade: 'Brasília',
        enderecoEstado: 'DF',
      }),
    );

  const cleanup = async () => {
    await ordersRepository.delete({ idUsuario: cpf });
    await ordersRepository.delete({ idUsuario: Like('X%') });
    await peopleRepository.delete({ cpf });
    await peopleRepository.delete({ email: Like('%@anonimizado.invalid') });
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    ordersRepository = moduleRef.get(getRepositoryToken(Order));
    addressRepository = moduleRef.get(getRepositoryToken(Address));
    jwtService = moduleRef.get(JwtService);
  });

  beforeEach(async () => {
    await cleanup();
    await peopleRepository.save({
      cpf,
      nome: 'Titular LGPD',
      email: 'titular_lgpd@example.com',
      telefone: '61999990000',
      senha: 'hash',
    });
  });

  afterAll(async () => {
    if (ordersRepository) await cleanup();
    if (app) await app.close();
  });

  it('sem pedidos: apaga o cadastro (204)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/people/${cpf}`)
      .set('Authorization', `Bearer ${tokenOf(cpf)}`)
      .expect(204);

    expect(await peopleRepository.findOne({ where: { cpf } })).toBeNull();
  });

  it('com pedido entregue: anonimiza e preserva o pedido (204, não 500)', async () => {
    const order = await createOrder(OrderStatus.DELIVERED);
    await addressRepository.save(
      addressRepository.create({
        cpf_pessoa: cpf,
        cep: '70000-000',
        logradouro: 'Rua Pessoal',
        numero: '42',
        complemento: null,
        bairro: 'Asa Norte',
        cidade: 'Brasília',
        uf: 'DF',
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/people/${cpf}`)
      .set('Authorization', `Bearer ${tokenOf(cpf)}`)
      .expect(204);

    expect(await peopleRepository.findOne({ where: { cpf } })).toBeNull();
    expect(
      await peopleRepository.findOne({ where: { email: 'titular_lgpd@example.com' } }),
    ).toBeNull();
    expect(await addressRepository.count({ where: { cpf_pessoa: cpf } })).toBe(0);

    const kept = await ordersRepository.findOneOrFail({ where: { idPedido: order.idPedido } });
    expect(kept.idUsuario).toMatch(/^X[0-9a-f]{10}$/);
    expect(Number(kept.valorTotal)).toBe(120);
    expect(kept.status).toBe(OrderStatus.DELIVERED);
    expect(kept).toMatchObject({
      clienteTelefone: null,
      enderecoCep: null,
      enderecoRua: null,
      enderecoNumero: null,
      enderecoComplemento: null,
      enderecoBairro: null,
      enderecoCidade: 'Brasília',
      enderecoEstado: 'DF',
    });

    const pseudonym = await peopleRepository.findOneOrFail({ where: { cpf: kept.idUsuario! } });
    expect(pseudonym).toMatchObject({ nome: 'Cliente removido', telefone: null, senha: null });
  });

  it('com pedido pago em andamento: 409 e nada é alterado', async () => {
    const order = await createOrder(OrderStatus.PAID);

    await request(app.getHttpServer())
      .delete(`/api/people/${cpf}`)
      .set('Authorization', `Bearer ${tokenOf(cpf)}`)
      .expect(409);

    expect(await peopleRepository.findOne({ where: { cpf } })).not.toBeNull();
    const untouched = await ordersRepository.findOneOrFail({ where: { idPedido: order.idPedido } });
    expect(untouched).toMatchObject({ idUsuario: cpf, enderecoRua: 'Rua Pessoal' });
  });
});
