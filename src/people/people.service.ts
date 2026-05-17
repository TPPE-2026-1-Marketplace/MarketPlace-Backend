import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreatePersonDto } from './dtos/create-person.dto';
import { UpdatePersonDto } from './dtos/update-person.dto';
import { Person } from './entities/person.entity';
import { IPersonSafe } from './interfaces/person.interface';

/**
 * Código de erro do Postgres para violação de UNIQUE constraint.
 * Usado para mapear duplicatas de CPF/email para HTTP 409.
 */
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Person)
    private readonly peopleRepository: Repository<Person>,
  ) { }

  /**
   * Remove o campo `senha` antes de devolver uma Person.
   * TODA resposta de endpoint deve passar por aqui.
   */
  private stripPassword(person: Person): IPersonSafe {
    const { senha: _ignored, ...safe } = person;
    return safe;
  }

  async create(dto: CreatePersonDto): Promise<IPersonSafe> {
    // TODO(#34): aplicar hash bcrypt em `dto.senha` antes de persistir.
    // Esta issue (#33) implementa apenas o CRUD; o hashing entra na issue
    // seguinte do D0 ("feat(people): aplicar hash bcrypt em senhas").
    const person = this.peopleRepository.create({
      cpf: dto.cpf,
      nome: dto.nome,
      email: dto.email,
      telefone: dto.telefone ?? null,
      senha: dto.senha ?? null,
    });

    try {
      const saved = await this.peopleRepository.save(person);
      return this.stripPassword(saved);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
      ) {
        // O detalhe do erro do PG indica qual constraint foi violada.
        // Em vez de parsear a string, devolvemos uma mensagem genérica e
        // deixamos o cliente lidar.
        throw new ConflictException(
          'CPF ou email já cadastrado',
        );
      }
      throw err;
    }
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{
    data: IPersonSafe[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const [rows, total] = await this.peopleRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { nome: 'ASC' },
    });

    return {
      data: rows.map((p) => this.stripPassword(p)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(cpf: string): Promise<IPersonSafe> {
    const person = await this.peopleRepository.findOne({ where: { cpf } });
    if (!person) {
      throw new NotFoundException(`Pessoa com CPF ${cpf} não encontrada`);
    }
    return this.stripPassword(person);
  }

  async update(cpf: string, dto: UpdatePersonDto): Promise<IPersonSafe> {
    const person = await this.peopleRepository.findOne({ where: { cpf } });
    if (!person) {
      throw new NotFoundException(`Pessoa com CPF ${cpf} não encontrada`);
    }

    // TODO(#34): se `dto.senha` vier preenchida, aplicar bcrypt antes de persistir.
    Object.assign(person, dto);

    try {
      const saved = await this.peopleRepository.save(person);
      return this.stripPassword(saved);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email já cadastrado por outra pessoa');
      }
      throw err;
    }
  }

  async remove(cpf: string): Promise<void> {
    const result = await this.peopleRepository.delete({ cpf });
    if (result.affected === 0) {
      throw new NotFoundException(`Pessoa com CPF ${cpf} não encontrada`);
    }
  }

  /**
   * Busca interna por email. Retorna a Person COM senha — uso restrito ao
   * AuthService para validação de login. Não exportar via controller.
   */
  async findByEmailWithPassword(email: string): Promise<Person | null> {
    return this.peopleRepository.findOne({ where: { email } });
  }
}
