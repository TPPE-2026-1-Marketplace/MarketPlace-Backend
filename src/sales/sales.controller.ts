import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { Role } from '@prisma/client';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleStatusDto } from './dto/update-sale-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER, Role.SELLER)
  @ApiOperation({ summary: 'Create a new sale (Seller/Manager/Admin)' })
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: User) {
    return this.salesService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List all sales (Admin/Manager only)' })
  @ApiQuery({ name: 'sellerId', required: false })
  findAll(@Query('sellerId') sellerId?: string) {
    return this.salesService.findAll(sellerId);
  }

  @Get('my-sales')
  @Roles(Role.SELLER, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: "List current seller's sales" })
  findMySales(@CurrentUser() user: User) {
    return this.salesService.findAll(user.id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.SELLER)
  @ApiOperation({ summary: 'Get sale by id' })
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update sale status (Admin/Manager only)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSaleStatusDto) {
    return this.salesService.updateStatus(id, dto);
  }
}
