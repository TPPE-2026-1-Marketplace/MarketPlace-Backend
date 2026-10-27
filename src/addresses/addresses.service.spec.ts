import { NotFoundException } from '@nestjs/common';
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

type RepoMock = jest.Mocked<Pick<Repository<Address>, 'create' | 'save' | 'find' | 'findOne' | 'update' | 'delete'>>;

describe('AddressesService', () => {
  let service: AddressesService;
  let repo: RepoMock;

  beforeEach(async () => {
    repo = {
      create: jest.fn((input) => input as Address),
      save: jest.fn(async (input) => input as Address),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AddressesService, { provide: getRepositoryToken(Address), useValue: repo }],
    }).compile();

    service = moduleRef.get(AddressesService);
  });

  describe('create', () => {
    it('cria o endereço mapeando o cpf e os campos do dto', async () => {
      const result = await service.create(CPF, baseDto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cpf_pessoa: CPF,
          cep: baseDto.cep,
          logradouro: baseDto.logradouro,
          complemento: 'Bloco A',
          uf: 'DF',
          nome: null,
          principal: false,
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

    it('grava nome e principal quando fornecidos', async () => {
      await service.create(CPF, { ...baseDto, nome: 'Casa', principal: true });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ nome: 'Casa', principal: true }),
      );
    });

    it('desmarca os outros endereços como principal ao criar um novo principal', async () => {
      await service.create(CPF, { ...baseDto, principal: true });

      expect(repo.update).toHaveBeenCalledWith({ cpf_pessoa: CPF }, { principal: false });
    });

    it('não desmarca outros endereços quando o novo não é principal', async () => {
      await service.create(CPF, baseDto);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('findAllByCpf', () => {
    it('lista os endereços da pessoa, principal primeiro', async () => {
      repo.find.mockResolvedValue([{ id: 1 } as Address]);

      const result = await service.findAllByCpf(CPF);

      expect(repo.find).toHaveBeenCalledWith({
        where: { cpf_pessoa: CPF },
        order: { principal: 'DESC', id: 'ASC' },
      });
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('findOneOwned', () => {
    it('retorna o endereço quando pertence à pessoa', async () => {
      const address = { id: 1, cpf_pessoa: CPF } as Address;
      repo.findOne.mockResolvedValue(address);

      await expect(service.findOneOwned(1, CPF)).resolves.toBe(address);
    });

    it('lança NotFoundException quando o endereço não existe ou não pertence à pessoa', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOneOwned(999, CPF)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('atualiza os campos informados', async () => {
      const address = { id: 1, cpf_pessoa: CPF, nome: 'Casa' } as Address;
      repo.findOne.mockResolvedValue(address);
      repo.save.mockResolvedValue({ ...address, nome: 'Trabalho' });

      const result = await service.update(1, CPF, { nome: 'Trabalho' });

      expect(result.nome).toBe('Trabalho');
    });

    it('desmarca os outros endereços como principal ao marcar este como principal', async () => {
      const address = { id: 1, cpf_pessoa: CPF, principal: false } as Address;
      repo.findOne.mockResolvedValue(address);
      repo.save.mockResolvedValue({ ...address, principal: true });

      await service.update(1, CPF, { principal: true });

      expect(repo.update).toHaveBeenCalledWith({ cpf_pessoa: CPF }, { principal: false });
    });

    it('lança NotFoundException quando o endereço não pertence à pessoa', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(1, CPF, { nome: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove o endereço quando pertence à pessoa', async () => {
      repo.findOne.mockResolvedValue({ id: 1, cpf_pessoa: CPF } as Address);
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await expect(service.remove(1, CPF)).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith({ id: 1, cpf_pessoa: CPF });
    });

    it('lança NotFoundException quando o endereço não pertence à pessoa', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(1, CPF)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
