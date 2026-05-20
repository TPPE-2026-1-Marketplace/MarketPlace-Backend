import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
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
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { QueryStockLogsDto } from './dtos/query-stock-logs.dto';
import { UpdateStockDto } from './dtos/update-stock.dto';
import { MovementType } from './entities/stock-log.entity';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':sku')
  @ApiOperation({ summary: 'Consulta disponibilidade de estoque de uma variante (público)' })
  @ApiParam({ name: 'sku', description: 'Código SKU da variante' })
  @ApiResponse({ status: 200, description: 'Quantidades em estoque' })
  @ApiResponse({ status: 404, description: 'Variante não encontrada' })
  findPublic(@Param('sku') sku: string) {
    return this.inventoryService.findPublic(sku);
  }

  @Patch(':sku')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ajusta o estoque manualmente (gerente/admin)' })
  @ApiParam({ name: 'sku', description: 'Código SKU da variante' })
  @ApiResponse({ status: 200, description: 'Estoque ajustado' })
  @ApiResponse({ status: 400, description: 'Valor negativo ou payload inválido' })
  @ApiResponse({ status: 403, description: 'Sem permissão (requer gerente ou admin)' })
  @ApiResponse({ status: 404, description: 'Variante não encontrada' })
  adjust(
    @Param('sku') sku: string,
    @Body() dto: UpdateStockDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.adjust(sku, dto, user.sub);
  }

  @Get(':sku/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Histórico de movimentações de estoque de uma variante (admin)' })
  @ApiParam({ name: 'sku', description: 'Código SKU da variante' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'tipoMovimentacao', required: false, enum: MovementType })
  @ApiQuery({ name: 'dataInicio', required: false, example: '2026-01-01T00:00:00Z' })
  @ApiQuery({ name: 'dataFim', required: false, example: '2026-12-31T23:59:59Z' })
  @ApiResponse({ status: 200, description: 'Histórico paginado de movimentações' })
  @ApiResponse({ status: 403, description: 'Sem permissão (requer admin)' })
  getLogs(@Param('sku') sku: string, @Query() query: QueryStockLogsDto) {
    return this.inventoryService.getLogs(sku, query.page, query.limit, {
      tipoMovimentacao: query.tipoMovimentacao,
      dataInicio: query.dataInicio ? new Date(query.dataInicio) : undefined,
      dataFim: query.dataFim ? new Date(query.dataFim) : undefined,
    });
  }
}
