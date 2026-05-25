import {
  Body,
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateSalesGoalDto } from './dtos/create-sales-goal.dto';
import { QueryProgressDto } from './dtos/query-progress.dto';
import { QuerySalesGoalDto } from './dtos/query-sales-goal.dto';
import { UpdateSalesGoalDto } from './dtos/update-sales-goal.dto';
import { SalesGoalsService } from './sales-goals.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('sales-goals')
@Controller('sales-goals')
export class SalesGoalsController {
  constructor(private readonly salesGoalsService: SalesGoalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastra uma nova meta mensal individual ou coletiva (Administrador)' })
  @ApiResponse({ status: 201, description: 'Meta de vendas cadastrada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de validação incorretos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (Requer Administrador)' })
  @ApiResponse({ status: 404, description: 'Funcionário informado não encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Meta já cadastrada para o funcionário/período especificado',
  })
  create(@Body() dto: CreateSalesGoalDto) {
    return this.salesGoalsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lista as metas mensais cadastradas com filtros opcionais (Administrador)',
  })
  @ApiResponse({ status: 200, description: 'Metas retornadas com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (Requer Administrador)' })
  findAll(@Query() query: QuerySalesGoalDto) {
    return this.salesGoalsService.findAll(query);
  }

  @Get('progress')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Visualiza o progresso das metas individuais (Administrador)' })
  @ApiResponse({
    status: 200,
    description: 'Progresso das metas individuais retornado com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (Requer Administrador)' })
  getIndividualProgress(@Query() query: QueryProgressDto) {
    return this.salesGoalsService.getIndividualProgress(query);
  }

  @Get('progress/team')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Visualiza o progresso da meta coletiva da equipe (Administrador)' })
  @ApiResponse({ status: 200, description: 'Progresso da meta coletiva retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (Requer Administrador)' })
  @ApiResponse({ status: 404, description: 'Meta coletiva não cadastrada para o período' })
  getTeamProgress(@Query() query: QueryProgressDto) {
    return this.salesGoalsService.getTeamProgress(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza uma meta existente (Administrador)' })
  @ApiResponse({ status: 200, description: 'Meta de vendas atualizada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de validação incorretos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (Requer Administrador)' })
  @ApiResponse({ status: 404, description: 'Meta ou funcionário informado não encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Meta já cadastrada para o funcionário/período especificado',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSalesGoalDto) {
    return this.salesGoalsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui uma meta existente (Administrador)' })
  @ApiResponse({ status: 204, description: 'Meta de vendas excluída com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (Requer Administrador)' })
  @ApiResponse({ status: 404, description: 'Meta não encontrada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.salesGoalsService.remove(id);
  }
}
