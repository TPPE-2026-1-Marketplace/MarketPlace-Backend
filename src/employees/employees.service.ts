import * as crypto from 'crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import {
  BCRYPT_ROUNDS,
  EMPLOYEE_DEFAULT_COMMISSION_RATE,
  PG_UNIQUE_VIOLATION,
  TEMP_PASSWORD_BYTES,
} from '../common/constants';
import { CreateEmployeeDto } from './dtos/create-employee.dto';
import { UpdateEmployeeDto } from './dtos/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { Person } from '../people/entities/person.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private stripPersonPassword(employee: Employee): Employee {
    if (employee.person) {
      const { senha: _ignored, ...personSafe } = employee.person;
      return { ...employee, person: personSafe as Employee['person'] };
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    // eslint-disable-next-line complexity
    return this.dataSource.transaction(async (manager) => {
      const peopleRepository = manager.getRepository(Person);
      const employeesRepository = manager.getRepository(Employee);

      let person = await peopleRepository.findOne({
        where: { cpf: dto.cpf },
      });

      // Gera uma senha temporária aleatória de 8 caracteres e faz o hash
      const senhaTemporaria = crypto.randomBytes(TEMP_PASSWORD_BYTES).toString('hex');
      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const hashedSenha = await bcrypt.hash(senhaTemporaria, salt);

      if (person) {
        const existingEmployee = await employeesRepository.findOne({
          where: { cpf: dto.cpf },
        });

        if (existingEmployee) {
          throw new ConflictException('Funcionário já cadastrado com este CPF');
        }

        // Validação contra undefined para não apagar dados existentes acidentalmente
        if (dto.nome !== undefined) person.nome = dto.nome;
        if (dto.email !== undefined) person.email = dto.email;
        if (dto.telefone !== undefined) person.telefone = dto.telefone;

        // Atualizamos a senha para garantir que o funcionário consiga logar
        person.senha = hashedSenha;

        person = await peopleRepository.save(person);
      } else {
        person = peopleRepository.create({
          cpf: dto.cpf,
          nome: dto.nome,
          email: dto.email,
          telefone: dto.telefone ?? null,
          senha: hashedSenha,
        });
        person = await peopleRepository.save(person);
      }

      const employee = employeesRepository.create({
        cpf: person.cpf,
        person: person,
        ativo: dto.ativo ?? true,
        role_perfil: dto.role_perfil,
        taxa_comissao: dto.taxa_comissao ?? EMPLOYEE_DEFAULT_COMMISSION_RATE,
        meta_vendas: dto.meta_vendas ?? null,
        codigo_funcionario: dto.codigo_funcionario ?? null,
      });

      try {
        const savedEmployee = await employeesRepository.save(employee);

        return {
          ...this.stripPersonPassword(savedEmployee),
          senha_temporaria: senhaTemporaria,
        };
      } catch (err) {
        if (
          err instanceof QueryFailedError &&
          (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
        ) {
          throw new ConflictException(
            'Email ou código de funcionário já em uso por outro registro',
          );
        }

        throw err;
      }
    });
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{
    data: Employee[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const [rows, total] = await this.employeesRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { cpf: 'ASC' },
    });

    return {
      data: rows.map((e) => this.stripPersonPassword(e)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(cpf: string): Promise<Employee> {
    const employee = await this.employeesRepository.findOne({
      where: { cpf },
    });

    if (!employee) {
      throw new NotFoundException(`Employee com CPF ${cpf} não encontrado`);
    }

    return this.stripPersonPassword(employee);
  }

  async update(cpf: string, dto: UpdateEmployeeDto): Promise<Employee> {
    // eslint-disable-next-line complexity
    return this.dataSource.transaction(async (manager) => {
      const peopleRepository = manager.getRepository(Person);
      const employeesRepository = manager.getRepository(Employee);

      const employee = await employeesRepository.findOne({ where: { cpf } });
      if (!employee) {
        throw new NotFoundException(`Employee com CPF ${cpf} não encontrado`);
      }

      const person = await peopleRepository.findOne({ where: { cpf } });
      if (!person) {
        throw new NotFoundException(`Person com CPF ${cpf} não encontrada`);
      }

      if (dto.nome !== undefined) person.nome = dto.nome;
      if (dto.email !== undefined) person.email = dto.email;
      if (dto.telefone !== undefined) person.telefone = dto.telefone ?? null;

      if (dto.ativo !== undefined) employee.ativo = dto.ativo;
      if (dto.role_perfil !== undefined) employee.role_perfil = dto.role_perfil;
      if (dto.taxa_comissao !== undefined) employee.taxa_comissao = dto.taxa_comissao;
      if (dto.meta_vendas !== undefined) employee.meta_vendas = dto.meta_vendas;
      if (dto.codigo_funcionario !== undefined)
        employee.codigo_funcionario = dto.codigo_funcionario;

      try {
        await peopleRepository.save(person);
        const updated = await employeesRepository.save(employee);
        return this.stripPersonPassword(updated);
      } catch (err) {
        if (
          err instanceof QueryFailedError &&
          (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
        ) {
          throw new ConflictException('Email ou código de funcionário já cadastrado');
        }

        throw err;
      }
    });
  }
}
