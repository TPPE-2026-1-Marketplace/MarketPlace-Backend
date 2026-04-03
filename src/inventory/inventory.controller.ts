import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { Role } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List all inventory records (Admin/Manager only)' })
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get('audit-logs')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get all audit logs (Admin/Manager only)' })
  getAuditLogs() {
    return this.inventoryService.getAuditLogs();
  }

  @Get('product/:productId')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get inventory for a specific product' })
  findByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findByProduct(productId);
  }

  @Patch('product/:productId/adjust')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Manually adjust stock for a product (Manager/Admin only)',
  })
  adjustStock(
    @Param('productId') productId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.inventoryService.adjustStock(productId, dto, currentUser);
  }
}
