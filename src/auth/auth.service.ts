import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Person } from '../people/entities/person.entity';
import { LoginDto } from './dtos/login.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const person = await this.personRepository.findOne({
      where: { email: dto.email },
    });

    if (!person) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    if (!person.senha) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const isPasswordValid = await bcrypt.compare(dto.senha, person.senha);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const payload = {
      sub: person.cpf,
      email: person.email,
      role: Role.CLIENTE, // Será atualizado em D2 quando Employee for implementado
    };

    const access_token = this.jwtService.sign(payload);

    return { access_token };
  }
}
