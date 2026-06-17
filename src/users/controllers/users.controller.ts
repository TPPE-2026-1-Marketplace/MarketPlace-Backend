import { Controller, Post, Get, Patch, Body, Param, ParseIntPipe, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UsersService } from '../services/users.service';

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

    UsersController.logger.log(`Usuário criado com sucesso: id=${retorno.id}`);

    return retorno;
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    UsersController.logger.log(`Requisição GET api/users/${id}`);

    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException(`Usuário com id=${id} não encontrado.`);
    }

    return this.usersService.toSafeUser(user);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    UsersController.logger.log(`Requisição PATCH api/users/${id}`);
    UsersController.logger.debug(`Payload: ${JSON.stringify(updateUserDto)}`);

    const updated = await this.usersService.update(id, updateUserDto);

    UsersController.logger.log(`Usuário id=${id} atualizado com sucesso.`);

    return updated;
  }
}

