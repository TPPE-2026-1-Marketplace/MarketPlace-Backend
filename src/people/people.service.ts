import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { QueryFailedError, Repository } from 'typeorm';
import { RegisterPersonDto } from './dtos/register-person.dto';
import { RegisterUserDto } from './dtos/register-user.dto';
import { UpdatePersonDto } from './dtos/update-person.dto';
import { Person } from './entities/person.entity';
import { IPersonSafe } from './interfaces/person.interface';

const PG_UNIQUE_VIOLATION = '23505';
const BCRYPT_ROUNDS = 10;

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

  /**
   * Fluxo 1: Caixa registra uma pessoa na loja física.
   *
   * - Verifica se existe Person com esse email
   * - Se existe: retorna erro (email deve ser único)
   * - Se não existe: cria Person sem senha
   *
   * Depois, a pessoa pode completar o cadastro via registerUser (fluxo 2).
   */
  async registerPerson(dto: RegisterPersonDto): Promise<IPersonSafe> {
    const existingEmail = await this.peopleRepository.findOne({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email já cadastrado');
    }

    const person = this.peopleRepository.create({
      cpf: dto.cpf,
      nome: dto.nome,
      email: dto.email,
      telefone: dto.telefone ?? null,
      senha: null, // Sem senha — cliente não faz login ainda
    });

    try {
      const saved = await this.peopleRepository.save(person);
      return this.stripPassword(saved);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('CPF ou email já cadastrado');
      }
      throw err;
    }
  }

  /**
   * Fluxo 2: Usuário completa auto-cadastro pelo site.
   *
   * - Verifica se existe Person com esse CPF (do fluxo 1)
   *   - Se existe: atualiza com senha (não cria nova)
   *   - Se não existe: cria Person nova com senha
   * - Se endereço vem no payload: será persistido em tabela separada
   *   (será feito via AddressService em future)
   */
  async registerUser(dto: RegisterUserDto): Promise<IPersonSafe> {
    const senhaHash = await bcrypt.hash(dto.senha, BCRYPT_ROUNDS);

    // Se CPF foi informado, verifica se já existe
    if (dto.cpf) {
      const existing = await this.peopleRepository.findOne({
        where: { cpf: dto.cpf },
      });

      if (existing) {
        // Pessoa já existe (do fluxo 1): atualiza com senha
        if (existing.senha) {
          throw new ConflictException('Este CPF já possui uma conta completa');
        }

        existing.senha = senhaHash;
        if (dto.nome) {
          existing.nome = dto.nome;
        }
        if (dto.telefone) {
          existing.telefone = dto.telefone;
        }

        const updated = await this.peopleRepository.save(existing);
        return this.stripPassword(updated);
      }
    }

    // CPF não existe ou não foi informado: cria Person nova
    const person = this.peopleRepository.create({
      cpf: dto.cpf,
      nome: dto.nome || 'Usuário',
      email: dto.email,
      telefone: dto.telefone ?? null,
      senha: senhaHash,
    });

    try {
      const saved = await this.peopleRepository.save(person);
      return this.stripPassword(saved);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email já cadastrado');
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

    const updates: Partial<Person> = { ...dto } as Partial<Person>;
    if (dto.senha) {
      updates.senha = await bcrypt.hash(dto.senha, BCRYPT_ROUNDS);
    }
    Object.assign(person, updates);

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

  async validatePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  /**
   * Busca interna por email. Retorna a Person COM senha — uso restrito ao
   * AuthService para validação de login. Não exportar via controller.
   */
  async findByEmailWithPassword(email: string): Promise<Person | null> {
    return this.peopleRepository.findOne({ where: { email } });
  }
}
