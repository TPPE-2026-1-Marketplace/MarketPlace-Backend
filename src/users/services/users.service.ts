import { Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>
  ) {
    console.log("Repositório de usuários injetado:", this.usersRepository);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      return await this.usersRepository.save(createUserDto);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      throw new Error('Falha ao criar o usuário no banco de dados.');
    }
  }
}