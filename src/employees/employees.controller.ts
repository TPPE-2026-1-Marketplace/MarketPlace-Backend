import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateEmployeeDto } from './dtos/create-employee.dto';
import { QueryRankingDto } from './dtos/query-ranking.dto';
import { UpdateEmployeeDto } from './dtos/update-employee.dto';
import { EmployeesService } from './employees.service';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dtos';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADOR)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um funcionário em uma única chamada (Administrador)' })
  @ApiResponse({ status: 201, description: 'Funcionário criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 409, description: 'CPF já cadastrado' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  @Roles(Role.ADMINISTRADOR, Role.GERENTE, Role.CAIXA, Role.VENDEDOR)
  @ApiOperation({ summary: 'Lista funcionários com paginação (Administrador)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista paginada de funcionários' })
  findAll(@Query() query: PaginationDto) {
    return this.employeesService.findAll(query.page, query.limit);
  }

  @Get('ranking')
  @Roles(Role.CAIXA, Role.VENDEDOR, Role.GERENTE, Role.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Visualiza o ranking mensal dos vendedores (Caixa, vendedor, gerente ou administrador)',
  })
  @ApiResponse({ status: 200, description: 'Ranking retornado com sucesso' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  getSellersRanking(@Query() query: QueryRankingDto) {
    return this.employeesService.getSellersRanking(query);
  }

  @Get(':cpf')
  @ApiOperation({ summary: 'Busca um funcionário por CPF (Administrador)' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Funcionário encontrado' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  findOne(@Param('cpf') cpf: string) {
    return this.employeesService.findOne(cpf);
  }

  @Get(':cpf/commissions')
  @Roles(Role.CAIXA, Role.VENDEDOR, Role.GERENTE, Role.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Obtém o relatório de comissões e vendas do funcionário no mês e ano (Administrador/Gerente/Caixa/Vendedor)',
  })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiQuery({ name: 'mes', required: false, example: 5 })
  @ApiQuery({ name: 'ano', required: false, example: 2026 })
  @ApiResponse({ status: 200, description: 'Relatório de comissões retornado com sucesso' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  getCommissionReport(@Param('cpf') cpf: string, @Query() query: QueryRankingDto) {
    const now = new Date();
    const mes = query.mes ?? now.getMonth() + 1;
    const ano = query.ano ?? now.getFullYear();
    return this.employeesService.getCommissionReport(cpf, mes, ano);
  }

  @Patch(':cpf')
  @ApiOperation({ summary: 'Atualiza dados do funcionário (Administrador)' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Funcionário atualizado' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  @ApiResponse({ status: 409, description: 'Email ou código já cadastrado' })
  update(@Param('cpf') cpf: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(cpf, dto);
  }
}
