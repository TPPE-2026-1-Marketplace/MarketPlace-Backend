import { Controller, Get, Post, Body, Logger, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from '../services/products.service';
import { QueryProductsDto } from '../dtos/query-products.dto';
import { CreateProductDto } from '../dtos/create-product.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  private static readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query() query: QueryProductsDto) {
    ProductsController.logger.log(`GET api/products ${JSON.stringify(query)}`);
    return this.productsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    ProductsController.logger.log(`GET api/products/${id}`);
    return this.productsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateProductDto) {
    ProductsController.logger.log(`POST api/products ${JSON.stringify(dto)}`);
    return this.productsService.create(dto);
  }
}
