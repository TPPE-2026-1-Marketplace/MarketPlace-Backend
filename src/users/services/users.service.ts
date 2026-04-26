import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  private static readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>
  ) {
    UsersService.logger.log('Repositório de usuários inicializado');
  }

  async create(createUserDto: CreateUserDto, requestId = 'REQ-SEM-ID'): Promise<User> {
    try {
      const userEntity = this.usersRepository.create(createUserDto);
      const createdUser = await this.usersRepository.save(userEntity);
      UsersService.logger.log(`[${requestId}] Usuário salvo no banco (id=${createdUser.id})`);
      return createdUser;

    } catch (error) {
      UsersService.logger.error(
        `[${requestId}] Erro ao criar usuário no banco de dados`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException('Falha ao criar o usuário no banco de dados.');
    }
  }
}