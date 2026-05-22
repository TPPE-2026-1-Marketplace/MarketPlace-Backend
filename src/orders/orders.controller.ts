import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dtos/create-order.dto';
import { CreateInStoreOrderDto } from './dtos/create-in-store-order.dto';
import { UpdateTrackingDto } from './dtos/update-tracking.dto';
import { ConfirmPickupDto } from './dtos/confirm-pickup.dto';
import { ListOrdersQueryDto } from './dtos/list-orders-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista pedidos paginados com filtros (Gerente+)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de pedidos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (Requer Gerente+)' })
  findAll(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os próprios pedidos do cliente autenticado (paginado)' })
  @ApiResponse({ status: 200, description: 'Lista paginada dos pedidos do cliente' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  findMy(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.findAllByUser(user.sub, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria um novo pedido (Checkout Online)' })
  @ApiResponse({ status: 201, description: 'Pedido criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Cupom inválido ou dados incorretos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Variante de produto ou cliente não encontrada' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(user.sub, dto);
  }

  @Post('in-store')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CAIXA, Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra uma nova venda presencial no caixa (Caixa+)' })
  @ApiResponse({ status: 201, description: 'Venda presencial registrada com sucesso' })
  @ApiResponse({ status: 400, description: 'Vendedor inválido/não-vendedor, cupom inválido ou dados incorretos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Não possui perfil autorizado (Requer Caixa+)' })
  @ApiResponse({ status: 404, description: 'Variante de produto ou cliente cadastrado não encontrado' })
  @ApiResponse({ status: 409, description: 'Estoque de loja física insuficiente' })
  createInStore(@Body() dto: CreateInStoreOrderDto) {
    return this.ordersService.createInStore(dto);
  }

  @Patch(':id/tracking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENDEDOR, Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Insere manualmente o código de rastreamento de frete (Vendedor+)' })
  @ApiParam({ name: 'id', description: 'ID do pedido' })
  @ApiResponse({ status: 200, description: 'Código de rastreamento inserido com sucesso e status atualizado para shipped' })
  @ApiResponse({ status: 400, description: 'Pedido com retirada na loja não aceita código' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role (Requer Vendedor+)' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  updateTracking(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrackingDto,
  ) {
    return this.ordersService.updateTracking(id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta os detalhes de um pedido específico (Autenticado, Dono ou Funcionário)' })
  @ApiParam({ name: 'id', description: 'ID do pedido' })
  @ApiResponse({ status: 200, description: 'Detalhes do pedido retornados com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Não possui autorização para consultar este pedido' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.findOne(id, user);
  }

  @Get(':id/verification-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Recupera o código de verificação para retirada na loja física' })
  @ApiParam({ name: 'id', description: 'ID do pedido' })
  @ApiResponse({ status: 200, description: 'Código retornado com sucesso' })
  @ApiResponse({ status: 400, description: 'Pedido não está configurado para retirada na loja' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Não possui autorização' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  getVerificationCode(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.getVerificationCode(id, user);
  }

  @Post(':id/confirm-pickup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CAIXA, Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma a retirada física de um pedido pelo cliente via validação do PIN (Caixa+)' })
  @ApiParam({ name: 'id', description: 'ID do pedido' })
  @ApiResponse({ status: 200, description: 'Retirada física confirmada com sucesso e status atualizado para delivered' })
  @ApiResponse({ status: 400, description: 'PIN incorreto, pedido não pago ou modalidade incorreta' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Não possui autorização (Requer Caixa+)' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  confirmPickup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPickupDto,
  ) {
    return this.ordersService.confirmPickup(id, dto);
  }
}
