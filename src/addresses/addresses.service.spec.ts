import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AddressesService } from './addresses.service';
import { Address } from './entities/address.entity';

import type { CreateAddressDto } from './dtos/create-address.dto';
import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

const CPF = '12345678901';

const baseDto: CreateAddressDto = {
  cep: '70002900',
  logradouro: 'Esplanada dos Ministérios',
  numero: '10',
  complemento: 'Bloco A',
  bairro: 'Zona Cívico-Administrativa',
  cidade: 'Brasília',
  uf: 'DF',
};

describe('AddressesService', () => {
  let service: AddressesService;
  let repo: jest.Mocked<Pick<Repository<Address>, 'create' | 'save'>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn((input) => input as Address),
      save: jest.fn(async (input) => input as Address),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AddressesService, { provide: getRepositoryToken(Address), useValue: repo }],
    }).compile();

    service = moduleRef.get(AddressesService);
  });

  it('cria o endereço mapeando o cpf e os campos do dto', async () => {
    const result = await service.create(CPF, baseDto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cpf_pessoa: CPF,
        cep: baseDto.cep,
        logradouro: baseDto.logradouro,
        complemento: 'Bloco A',
        uf: 'DF',
      }),
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.cpf_pessoa).toBe(CPF);
  });

  it('normaliza complemento ausente para null', async () => {
    const { complemento: _omit, ...semComplemento } = baseDto;
    await service.create(CPF, semComplemento as CreateAddressDto);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ complemento: null }));
  });
});
