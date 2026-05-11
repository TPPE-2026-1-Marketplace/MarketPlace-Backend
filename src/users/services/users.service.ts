import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';
import { IUserValidation } from '../interfaces/user.interface';
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

  async findAll(): Promise<IUserValidation[]> {
    const users = await this.usersRepository.find();
    return users.map(({ password: _, ...rest }) => rest as IUserValidation);
  }

  async findOne(id: number): Promise<IUserValidation> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`Usuário com id=${id} não encontrado.`);
    }
    const { password: _, ...rest } = user;
    return rest as IUserValidation;
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