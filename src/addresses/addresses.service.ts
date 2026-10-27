import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateAddressDto, UpdateAddressDto } from './dtos/create-address.dto';
import { Address } from './entities/address.entity';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  /** Só um endereço principal por pessoa: desmarca os demais antes de gravar. */
  private async clearPrincipal(cpfPessoa: string): Promise<void> {
    await this.addressRepository.update({ cpf_pessoa: cpfPessoa }, { principal: false });
  }

  async create(cpfPessoa: string, dto: CreateAddressDto): Promise<Address> {
    if (dto.principal) {
      await this.clearPrincipal(cpfPessoa);
    }

    const address = this.addressRepository.create({
      cpf_pessoa: cpfPessoa,
      nome: dto.nome ?? null,
      principal: dto.principal ?? false,
      cep: dto.cep,
      logradouro: dto.logradouro,
      numero: dto.numero,
      complemento: dto.complemento ?? null,
      bairro: dto.bairro,
      cidade: dto.cidade,
      uf: dto.uf,
    });
    return this.addressRepository.save(address);
  }

  async findAllByCpf(cpfPessoa: string): Promise<Address[]> {
    return this.addressRepository.find({
      where: { cpf_pessoa: cpfPessoa },
      order: { principal: 'DESC', id: 'ASC' },
    });
  }

  async findOneOwned(id: number, cpfPessoa: string): Promise<Address> {
    const address = await this.addressRepository.findOne({ where: { id, cpf_pessoa: cpfPessoa } });
    if (!address) {
      throw new NotFoundException(`Endereço ${id} não encontrado`);
    }
    return address;
  }

  async update(id: number, cpfPessoa: string, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.findOneOwned(id, cpfPessoa);

    if (dto.principal) {
      await this.clearPrincipal(cpfPessoa);
    }

    Object.assign(address, dto);
    return this.addressRepository.save(address);
  }

  async remove(id: number, cpfPessoa: string): Promise<void> {
    await this.findOneOwned(id, cpfPessoa);
    await this.addressRepository.delete({ id, cpf_pessoa: cpfPessoa });
  }
}
