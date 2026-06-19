import { Controller, Post, Get, Param, Body, Logger, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './create-order.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  private static readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    OrdersController.logger.log(`POST api/orders`);
    return this.ordersService.create(dto);
  }

  @Get()
  async findAll() {
    OrdersController.logger.log(`GET api/orders`);
    return this.ordersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    OrdersController.logger.log(`GET api/orders/${id}`);
    return this.ordersService.findOne(id);
  }
}
