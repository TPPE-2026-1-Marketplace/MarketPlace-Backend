import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import type { TestingModule } from '@nestjs/testing';

const mockAddressesService = {
  findAllByCpf: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const user = { sub: '12345678901', email: 'joao@email.com', role: 'cliente' };

describe('AddressesController', () => {
  let controller: AddressesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [{ provide: AddressesService, useValue: mockAddressesService }],
    }).compile();

    controller = module.get(AddressesController);
  });

  it('exige JwtAuthGuard em todas as rotas (guard no nível do controller)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AddressesController);

    expect(guards).toEqual([JwtAuthGuard]);
  });

  it('findMy delega para findAllByCpf com o cpf da cliente autenticada', async () => {
    mockAddressesService.findAllByCpf.mockResolvedValue([{ id: 1 }]);

    const result = await controller.findMy(user);

    expect(mockAddressesService.findAllByCpf).toHaveBeenCalledWith(user.sub);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('create delega para o service com o cpf da cliente autenticada', async () => {
    const dto = {
      cep: '70002900',
      logradouro: 'Rua das Flores',
      numero: '120',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
    };
    mockAddressesService.create.mockResolvedValue({ id: 1, ...dto });

    await controller.create(user, dto);

    expect(mockAddressesService.create).toHaveBeenCalledWith(user.sub, dto);
  });

  it('update delega para o service com o id, o cpf e o dto', async () => {
    const dto = { nome: 'Trabalho' };
    mockAddressesService.update.mockResolvedValue({ id: 1, ...dto });

    await controller.update(user, 1, dto);

    expect(mockAddressesService.update).toHaveBeenCalledWith(1, user.sub, dto);
  });

  it('remove delega para o service com o id e o cpf', async () => {
    mockAddressesService.remove.mockResolvedValue(undefined);

    await controller.remove(user, 1);

    expect(mockAddressesService.remove).toHaveBeenCalledWith(1, user.sub);
  });
});
