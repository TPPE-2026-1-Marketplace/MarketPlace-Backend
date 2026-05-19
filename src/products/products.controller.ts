import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
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
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateProductDto } from './dtos/create-product.dto';
import { QueryProductsDto } from './dtos/query-products.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria um produto' })
  @ApiResponse({ status: 201, description: 'Produto criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista produtos com paginação e filtros' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @ApiQuery({ name: 'destaque', required: false, type: Boolean })
  @ApiQuery({ name: 'precoMin', required: false, type: Number })
  @ApiQuery({ name: 'precoMax', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de produtos' })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um produto por id' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Produto encontrado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza um produto' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Produto atualizado' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um produto' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Produto removido' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }

  @Post(':id/categories/:categoryId')
  @ApiOperation({ summary: 'Associa uma categoria a um produto' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'categoryId', type: Number })
  @ApiResponse({ status: 201, description: 'Categoria associada ao produto' })
  @ApiResponse({ status: 404, description: 'Produto ou categoria não encontrada' })
  addCategory(
    @Param('id', ParseIntPipe) id: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.productsService.addCategory(id, categoryId);
  }

  @Delete(':id/categories/:categoryId')
  @ApiOperation({ summary: 'Remove uma categoria de um produto' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'categoryId', type: Number })
  @ApiResponse({ status: 200, description: 'Categoria removida do produto' })
  @ApiResponse({ status: 404, description: 'Produto ou categoria não encontrada' })
  removeCategory(
    @Param('id', ParseIntPipe) id: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.productsService.removeCategory(id, categoryId);
  }
}
