import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateProductDto } from './dtos/create-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria um produto' })
  @ApiResponse({ status: 201, description: 'Produto criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
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
