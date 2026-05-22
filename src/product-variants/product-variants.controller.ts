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

import { CreateProductVariantDto } from './dtos/create-product-variant.dto';
import { QueryProductVariantsDto } from './dtos/query-product-variants.dto';
import { UpdateProductVariantDto } from './dtos/update-product-variant.dto';
import { ProductVariantsService } from './product-variants.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('product-variants')
@Controller('product-variants')
export class ProductVariantsController {
  constructor(private readonly productVariantsService: ProductVariantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria uma variante de produto' })
  @ApiResponse({ status: 201, description: 'Variante criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  create(@Body() dto: CreateProductVariantDto) {
    return this.productVariantsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista variantes de produto' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'ativo', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista paginada de variantes' })
  findAll(@Query() query: QueryProductVariantsDto) {
    return this.productVariantsService.findAll(query);
  }

  @Get(':sku')
  @ApiOperation({ summary: 'Busca uma variante por SKU' })
  @ApiParam({ name: 'sku', type: String })
  @ApiResponse({ status: 200, description: 'Variante encontrada' })
  @ApiResponse({ status: 404, description: 'Variante não encontrada' })
  findOne(@Param('sku') sku: string) {
    return this.productVariantsService.findOne(sku);
  }

  @Patch(':sku')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza uma variante' })
  @ApiParam({ name: 'sku', type: String })
  @ApiResponse({ status: 200, description: 'Variante atualizada' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 404, description: 'Variante não encontrada' })
  update(@Param('sku') sku: string, @Body() dto: UpdateProductVariantDto) {
    return this.productVariantsService.update(sku, dto);
  }

  @Delete(':sku')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma variante' })
  @ApiParam({ name: 'sku', type: String })
  @ApiResponse({ status: 204, description: 'Variante removida' })
  @ApiResponse({ status: 404, description: 'Variante não encontrada' })
  remove(@Param('sku') sku: string) {
    return this.productVariantsService.remove(sku);
  }
}
