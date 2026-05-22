import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateAddressDto } from './dtos/create-address.dto';
import { Address } from './entities/address.entity';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  async create(cpfPessoa: string, dto: CreateAddressDto): Promise<Address> {
    const address = this.addressRepository.create({
      cpf_pessoa: cpfPessoa,
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
}
