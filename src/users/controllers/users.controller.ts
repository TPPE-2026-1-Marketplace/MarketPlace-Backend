import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UsersService } from '../services/users.service';
import { User } from '../entities/user.entity';

@Controller('users')
export class UsersController {
  private static readonly logger = new Logger(UsersController.name);

  constructor(private usersService: UsersService) { }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const requestId = `REQ-${Date.now()}`;

    UsersController.logger.log(`Requisição de id:[${requestId}] recebida pelo endpoint POST api/users.`);
    UsersController.logger.debug(`Payload da requisição: ${JSON.stringify(createUserDto)}`);

    const retorno = await this.usersService.create(createUserDto, requestId);

    UsersController.logger.log(`Usuário criado com sucesso: ${JSON.stringify(retorno)}`);

  }
}
