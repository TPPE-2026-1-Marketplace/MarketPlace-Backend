import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX_LIMIT,
} from '../common/constants';
import { CreateEmployeeDto } from './dtos/create-employee.dto';
import { UpdateEmployeeDto } from './dtos/update-employee.dto';
import { EmployeesService } from './employees.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(PAGINATION_DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION_MAX_LIMIT)
    .default(PAGINATION_DEFAULT_LIMIT),
});

class PaginationDto extends createZodDto(PaginationSchema) {}

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADOR)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um funcionário em uma única chamada' })
  @ApiResponse({ status: 201, description: 'Funcionário criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 409, description: 'CPF já cadastrado' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista funcionários com paginação' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista paginada de funcionários' })
  findAll(@Query() query: PaginationDto) {
    return this.employeesService.findAll(query.page, query.limit);
  }

  @Get(':cpf')
  @ApiOperation({ summary: 'Busca um funcionário por CPF' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Funcionário encontrado' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  findOne(@Param('cpf') cpf: string) {
    return this.employeesService.findOne(cpf);
  }

  @Patch(':cpf')
  @ApiOperation({ summary: 'Atualiza dados do funcionário' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Funcionário atualizado' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  @ApiResponse({ status: 409, description: 'Email ou código já cadastrado' })
  update(@Param('cpf') cpf: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(cpf, dto);
  }
}
