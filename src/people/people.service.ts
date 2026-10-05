import { randomBytes } from 'crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager, In, Like, Not, QueryFailedError, Repository } from 'typeorm';

import { AddressesService } from '../addresses/addresses.service';
import {
  ANONYMIZED_CPF_PREFIX,
  ANONYMIZED_CPF_RANDOM_BYTES,
  ANONYMIZED_EMAIL_DOMAIN,
  ANONYMIZED_PERSON_NAME,
  BCRYPT_ROUNDS,
  PG_UNIQUE_VIOLATION,
} from '../common/constants';
import { RegisterPersonDto } from './dtos/register-person.dto';
import { RegisterUserDto } from './dtos/register-user.dto';
import { UpdatePersonDto } from './dtos/update-person.dto';
import { Person } from './entities/person.entity';
import { IPersonSafe } from './interfaces/person.interface';
import { Role } from '../common/enums/role.enum';
import { Order, OrderStatus } from '../orders/entities/order.entity';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

const ORDER_STATUSES_IN_PROGRESS = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.SHIPPED];

const NOT_ANONYMIZED = Not(Like(`%@${ANONYMIZED_EMAIL_DOMAIN}`));

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Person)
    private readonly peopleRepository: Repository<Person>,
    private readonly addressesService: AddressesService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

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
   * - Verifica se existe Person com esse CPF
   * - Se existe: retorna erro (CPF deve ser único)
   * - Se não existe: cria Person sem senha
   *
   * Depois, a pessoa pode completar o cadastro via registerUser (fluxo 2).
   */
  async registerPerson(dto: RegisterPersonDto): Promise<IPersonSafe> {
    const existingCpf = await this.peopleRepository.findOne({
      where: { cpf: dto.cpf },
    });

    if (existingCpf) {
      throw new ConflictException('CPF já cadastrado');
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
  // eslint-disable-next-line complexity
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
        if (dto.nome) existing.nome = dto.nome;
        if (dto.telefone) existing.telefone = dto.telefone;

        const updated = await this.peopleRepository.save(existing);
        if (dto.endereco) {
          await this.addressesService.create(updated.cpf, dto.endereco);
        }
        return this.stripPassword(updated);
      }
    }

    // CPF não existe ou não foi informado: cria Person nova
    const person = this.peopleRepository.create({
      cpf: dto.cpf,
      nome: dto.nome ?? null,
      email: dto.email,
      telefone: dto.telefone ?? null,
      senha: senhaHash,
    });

    try {
      const saved = await this.peopleRepository.save(person);
      if (dto.endereco) {
        await this.addressesService.create(saved.cpf, dto.endereco);
      }
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
      where: { email: NOT_ANONYMIZED },
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

  async findOne(cpf: string, user: CurrentUserPayload): Promise<IPersonSafe> {
    if (user.role === Role.CLIENTE && user.sub !== cpf) {
      throw new ForbiddenException('Você só pode acessar o próprio cadastro.');
    }

    const person = await this.peopleRepository.findOne({ where: { cpf } });
    if (!person) {
      throw new NotFoundException(`Pessoa com CPF ${cpf} não encontrada`);
    }
    return this.stripPassword(person);
  }

  private assertCanUpdate(cpf: string, dto: UpdatePersonDto, user: CurrentUserPayload): void {
    if (user.sub === cpf) {
      return;
    }

    const isManager = user.role === Role.GERENTE || user.role === Role.ADMINISTRADOR;
    if (!isManager) {
      throw new ForbiddenException(
        'Apenas gerente ou administrador podem alterar o cadastro de outra pessoa.',
      );
    }
    if (dto.senha !== undefined || dto.email !== undefined) {
      throw new ForbiddenException('Não é permitido alterar senha ou email de outra pessoa.');
    }
  }

  async update(cpf: string, dto: UpdatePersonDto, user: CurrentUserPayload): Promise<IPersonSafe> {
    this.assertCanUpdate(cpf, dto, user);

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

  /**
   * Exclusão do próprio cadastro (LGPD, #197).
   *
   * - Sem pedidos: hard delete (endereços e reviews caem em cascata).
   * - Com pedido em andamento: 409 — a entrega ainda depende dos dados.
   * - Só com pedidos encerrados: anonimiza. Os pedidos passam para uma Person
   *   pseudônima e perdem o snapshot pessoal (contato e endereço até o bairro),
   *   preservando itens, valores, datas, cidade e UF para retenção fiscal.
   */
  async remove(cpf: string, user: CurrentUserPayload): Promise<void> {
    if (user.sub !== cpf) {
      throw new ForbiddenException('Não é permitido remover o cadastro de outra pessoa.');
    }

    await this.dataSource.transaction(async (manager) => {
      const person = await manager.findOne(Person, {
        where: { cpf },
        lock: { mode: 'pessimistic_write' },
      });
      if (!person) {
        throw new NotFoundException(`Pessoa com CPF ${cpf} não encontrada`);
      }

      const linkedOrders = await manager.count(Order, { where: { idUsuario: cpf } });
      const inProgress = await manager.count(Order, {
        where: [
          { idUsuario: cpf, status: In(ORDER_STATUSES_IN_PROGRESS) },
          { clienteCpfAvulso: cpf, status: In(ORDER_STATUSES_IN_PROGRESS) },
        ],
      });
      if (inProgress > 0) {
        throw new ConflictException(
          'Há pedidos em andamento. A conta poderá ser excluída depois que forem entregues ou cancelados.',
        );
      }

      await this.redactOrdersOf(manager, cpf, linkedOrders > 0);
      await manager.delete(Person, { cpf });
    });
  }

  private async redactOrdersOf(
    manager: EntityManager,
    cpf: string,
    hasLinkedOrders: boolean,
  ): Promise<void> {
    const personalSnapshot: Partial<Order> = {
      clienteNomeAvulso: null,
      clienteCpfAvulso: null,
      clienteEmailAvulso: null,
      clienteTelefone: null,
      enderecoCep: null,
      enderecoRua: null,
      enderecoNumero: null,
      enderecoComplemento: null,
      enderecoBairro: null,
    };

    await manager.update(Order, { clienteCpfAvulso: cpf }, personalSnapshot);

    if (hasLinkedOrders) {
      const pseudonym = await manager.save(Person, this.buildPseudonym());
      await manager.update(
        Order,
        { idUsuario: cpf },
        { ...personalSnapshot, idUsuario: pseudonym.cpf },
      );
    }
  }

  private buildPseudonym(): Person {
    const cpf = ANONYMIZED_CPF_PREFIX + randomBytes(ANONYMIZED_CPF_RANDOM_BYTES).toString('hex');
    return this.peopleRepository.create({
      cpf,
      nome: ANONYMIZED_PERSON_NAME,
      email: `${cpf.toLowerCase()}@${ANONYMIZED_EMAIL_DOMAIN}`,
      telefone: null,
      senha: null,
    });
  }

  async getAllForExport(): Promise<Person[]> {
    return this.peopleRepository
      .createQueryBuilder('person')
      .leftJoin('employee', 'emp', 'emp.cpf = person.cpf')
      .where('emp.cpf IS NULL')
      .andWhere('person.email NOT LIKE :anonymized', {
        anonymized: `%@${ANONYMIZED_EMAIL_DOMAIN}`,
      })
      .orderBy('person.nome', 'ASC')
      .getMany();
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
