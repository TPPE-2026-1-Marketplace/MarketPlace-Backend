import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as csv from 'fast-csv';

import { RegisterPersonDto } from './dtos/register-person.dto';
import { RegisterUserDto } from './dtos/register-user.dto';
import { UpdatePersonDto } from './dtos/update-person.dto';
import { PeopleService } from './people.service';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dtos';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('people')
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Exporta a base de clientes para CSV (Administrador)' })
  @ApiResponse({ status: 200, description: 'Retorna arquivo CSV contendo os clientes' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async exportPeople(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clientes.csv"');

    const people = await this.peopleService.getAllForExport();

    const csvStream = csv.format({ headers: true });
    csvStream.pipe(res);

    for (const p of people) {
      csvStream.write({
        email: p.email,
        nome: p.nome || '',
        telefone: p.telefone || '',
        cpf: p.cpf,
      });
    }

    csvStream.end();
  }

  @Post('register-person')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra uma pessoa na loja (funcionário caixa)' })
  @ApiResponse({ status: 201, description: 'Pessoa registrada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CAIXA, Role.VENDEDOR, Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  registerPerson(@Body() dto: RegisterPersonDto) {
    return this.peopleService.registerPerson(dto);
  }

  @Post('register-user')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra um usuário no site (auto-cadastro)' })
  @ApiResponse({ status: 201, description: 'Usuário registrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado ou CPF já possui conta completa' })
  registerUser(@Body() dto: RegisterUserDto) {
    return this.peopleService.registerUser(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista pessoas com paginação' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista paginada de pessoas' })
  findAll(@Query() query: PaginationDto) {
    return this.peopleService.findAll(query.page, query.limit);
  }

  @Get(':cpf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Busca uma pessoa por CPF' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Pessoa encontrada' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  findOne(@Param('cpf') cpf: string) {
    return this.peopleService.findOne(cpf);
  }

  @Patch(':cpf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza dados de uma pessoa' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Pessoa atualizada' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado por outra pessoa' })
  update(@Param('cpf') cpf: string, @Body() dto: UpdatePersonDto) {
    return this.peopleService.update(cpf, dto);
  }

  @Delete(':cpf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma pessoa' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 204, description: 'Pessoa removida' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  remove(@Param('cpf') cpf: string) {
    return this.peopleService.remove(cpf);
  }
}
