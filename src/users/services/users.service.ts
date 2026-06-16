import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

/** Usuário sem o campo de senha — formato seguro para retornar pela API. */
export type SafeUser = Omit<User, 'password' | 'logBeforeInsert' | 'logAfterInsert'>;

@Injectable()
export class UsersService {
  private static readonly logger = new Logger(UsersService.name);
  private static readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {
    UsersService.logger.log('Repositório de usuários inicializado');
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

  /** Busca um usuário pelo e-mail, incluindo a senha (uso interno do Auth). */
  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  toSafeUser(user: User): SafeUser {
    const { password, logBeforeInsert, logAfterInsert, ...safe } = user;
    void password;
    void logBeforeInsert;
    void logAfterInsert;
    return safe;
  }
}
