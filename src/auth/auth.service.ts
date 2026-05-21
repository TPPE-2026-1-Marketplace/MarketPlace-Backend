import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { PeopleService } from '../people/people.service';
import { Role } from '../common/enums/role.enum';
import { LoginDto } from './dtos/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly peopleService: PeopleService,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const person = await this.peopleService.findByEmailWithPassword(dto.email);

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

    const employee = await this.employeeRepository.findOne({
      where: { cpf: person.cpf },
    });

    const role = employee ? employee.role_perfil : Role.CLIENTE;

    const access_token = this.jwtService.sign({
      sub: person.cpf,
      email: person.email,
      role,
    });

    return { access_token };
  }
}
