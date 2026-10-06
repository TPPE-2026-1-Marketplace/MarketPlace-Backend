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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';
import * as csv from 'fast-csv';

import { RegisterPersonDto } from './dtos/register-person.dto';
import { RegisterUserDto } from './dtos/register-user.dto';
import { UpdatePersonDto } from './dtos/update-person.dto';
import { PeopleService } from './people.service';
import { THROTTLE_REGISTER } from '../common/config/throttle.config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dtos';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

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
  @ApiOperation({
    summary: 'Registra uma pessoa na loja (Caixa, vendedor, gerente ou administrador)',
  })
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
  @UseGuards(ThrottlerGuard)
  @Throttle(THROTTLE_REGISTER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra um usuário no site (Público)' })
  @ApiResponse({ status: 201, description: 'Usuário registrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado ou CPF já possui conta completa' })
  @ApiResponse({ status: 429, description: 'Limite de cadastros excedido' })
  @ApiBearerAuth()
  registerUser(@Body() dto: RegisterUserDto) {
    return this.peopleService.registerUser(dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista pessoas com paginação (Funcionários)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista paginada de pessoas' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CAIXA, Role.VENDEDOR, Role.GERENTE, Role.ADMINISTRADOR)
  findAll(@Query() query: PaginationDto) {
    return this.peopleService.findAll(query.page, query.limit);
  }

  @Get(':cpf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Busca uma pessoa por CPF (dono do cadastro ou funcionário)' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Pessoa encontrada' })
  @ApiResponse({ status: 403, description: 'Cliente tentando acessar CPF de outra pessoa' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  findOne(@Param('cpf') cpf: string, @CurrentUser() user: CurrentUserPayload) {
    return this.peopleService.findOne(cpf, user);
  }

  @Patch(':cpf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Atualiza dados de uma pessoa (dono; administrador para qualquer pessoa; gerente para clientes, caixas e vendedores)',
  })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Pessoa atualizada' })
  @ApiResponse({
    status: 403,
    description:
      'Sem permissão para alterar o cadastro desta pessoa, ou gerente tentando alterar senha/email de terceiro',
  })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado por outra pessoa' })
  update(
    @Param('cpf') cpf: string,
    @Body() dto: UpdatePersonDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.peopleService.update(cpf, dto, user);
  }

  @Delete(':cpf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove o próprio cadastro (apenas o dono)',
    description:
      'Sem pedidos, o cadastro é apagado. Com pedidos encerrados, os dados pessoais são ' +
      'anonimizados e o histórico de pedidos é preservado (LGPD + retenção fiscal).',
  })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 204, description: 'Pessoa removida ou anonimizada' })
  @ApiResponse({ status: 403, description: 'Tentativa de remover o cadastro de outra pessoa' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  @ApiResponse({ status: 409, description: 'Há pedidos em andamento' })
  remove(@Param('cpf') cpf: string, @CurrentUser() user: CurrentUserPayload) {
    return this.peopleService.remove(cpf, user);
  }
}
