import { Controller, Post, Body } from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UsersService } from '../services/users.service';
import { User } from '../entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const retorno = await this.usersService.create(createUserDto);
    console.log("Usuário criado:", retorno);
  }
}
