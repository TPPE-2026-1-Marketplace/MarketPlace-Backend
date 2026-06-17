import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';

/** Usuário sem o campo de senha — formato seguro para retornar pela API. */
export type SafeUser = Omit<User, 'password' | 'logBeforeInsert' | 'logAfterInsert'>;

/** Usuários internos criados automaticamente no primeiro boot. */
const SEED_USERS = [
  { name: 'Super Admin DK', email: 'superadmin@dkfestas.com.br', password: 'super123', role: 'superadmin', telefone: '(11) 99999-0001' },
  { name: 'Gerente DK', email: 'gerente@dkfestas.com.br', password: 'gerente123', role: 'manager', telefone: '(11) 99999-0000' },
  { name: 'Ana Vendas', email: 'ana.vendas@dkfestas.com.br', password: 'ana123', role: 'employee', telefone: '(11) 98888-1111' },
  { name: 'Carlos Moda', email: 'carlos.moda@dkfestas.com.br', password: 'carlos123', role: 'employee', telefone: '(11) 98888-2222' },
  { name: 'Beatriz Estilo', email: 'beatriz.estilo@dkfestas.com.br', password: 'beatriz123', role: 'employee', telefone: '(11) 98888-3333' },
];

@Injectable()
export class UsersService implements OnModuleInit {
  private static readonly logger = new Logger(UsersService.name);
  private static readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {
    UsersService.logger.log('Repositório de usuários inicializado');
  }

  /** Cria usuários internos (superadmin, gerente, funcionários) se não existirem. */
  async onModuleInit(): Promise<void> {
    for (const seed of SEED_USERS) {
      const exists = await this.usersRepository.findOne({ where: { email: seed.email } });
      if (!exists) {
        const passwordHash = await bcrypt.hash(seed.password, UsersService.SALT_ROUNDS);
        const user = this.usersRepository.create({
          name: seed.name,
          email: seed.email,
          password: passwordHash,
          role: seed.role,
          telefone: seed.telefone,
        });
        await this.usersRepository.save(user);
        UsersService.logger.log(`Seed: usuário "${seed.name}" (${seed.role}) criado.`);
      }
    }
  }

  async create(createUserDto: CreateUserDto, requestId = 'REQ-SEM-ID'): Promise<SafeUser> {
    try {
      const passwordHash = await bcrypt.hash(createUserDto.password, UsersService.SALT_ROUNDS);

      const userEntity = this.usersRepository.create({
        ...createUserDto,
        password: passwordHash,
      });
      const createdUser = await this.usersRepository.save(userEntity);

      UsersService.logger.log(`[${requestId}] Usuário salvo no banco (id=${createdUser.id})`);

      return this.toSafeUser(createdUser);
    } catch (error) {
      // Violação de unicidade (email/cpf) no Postgres.
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505') {
        UsersService.logger.warn(`[${requestId}] E-mail ou CPF já cadastrado.`);
        throw new ConflictException('E-mail ou CPF já cadastrado.');
      }

      UsersService.logger.error(
        `[${requestId}] Erro ao criar usuário no banco de dados`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException('Falha ao criar o usuário no banco de dados.');
    }
  }

  /** Busca um usuário pelo ID. */
  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /** Busca um usuário pelo e-mail, incluindo a senha (uso interno do Auth). */
  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /** Atualiza parcialmente os dados de um usuário. */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`Usuário com id=${id} não encontrado.`);
    }

    try {
      // Se a senha foi alterada, faz o hash
      if (updateUserDto.password) {
        const passwordHash = await bcrypt.hash(updateUserDto.password, UsersService.SALT_ROUNDS);
        Object.assign(user, { ...updateUserDto, password: passwordHash });
      } else {
        // Remove password do DTO caso venha undefined/null para não sobrescrever
        const { password, ...safeUpdate } = updateUserDto;
        void password;
        Object.assign(user, safeUpdate);
      }

      const updatedUser = await this.usersRepository.save(user);

      UsersService.logger.log(`Usuário id=${id} atualizado com sucesso.`);

      return this.toSafeUser(updatedUser);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505') {
        throw new ConflictException('E-mail ou CPF já cadastrado por outro usuário.');
      }

      UsersService.logger.error(
        `Erro ao atualizar usuário id=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException('Falha ao atualizar o usuário.');
    }
  }

  toSafeUser(user: User): SafeUser {
    const { password, logBeforeInsert, logAfterInsert, ...safe } = user;
    void password;
    void logBeforeInsert;
    void logAfterInsert;
    return safe;
  }
}
