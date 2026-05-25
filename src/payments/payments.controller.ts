import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';

import { CreatePaymentDto } from './dtos/create-payment.dto';
import { InfinitePayWebhookDto } from './dtos/infinitepay-webhook.dto';
import { PaymentsService } from './payments.service';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registra tentativa de pagamento de um pedido (Cliente autenticado, dono do pedido)',
  })
  @ApiResponse({ status: 201, description: 'Pagamento registrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de validação incorretos ou pedido não pendente' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Não possui autorização para este pedido' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  @ApiResponse({ status: 409, description: 'Pedido já pago' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user, dto);
  }

  @Get('order/:idPedido')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Consulta o status de pagamento do pedido (Cliente autenticado, dono do pedido ou funcionário)',
  })
  @ApiParam({ name: 'idPedido', description: 'ID do pedido a ser consultado' })
  @ApiResponse({ status: 200, description: 'Detalhes do pagamento retornados com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Não possui autorização para consultar o pagamento' })
  @ApiResponse({ status: 404, description: 'Pedido ou pagamento não encontrado' })
  findByOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('idPedido', ParseIntPipe) idPedido: number,
  ) {
    return this.paymentsService.findByOrder(user, idPedido);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook para processamento de notificações de pagamento da InfinitePay (Público)',
  })
  @ApiResponse({ status: 200, description: 'Webhook processado com sucesso' })
  @ApiResponse({ status: 404, description: 'Pagamento associado não encontrado' })
  handleWebhook(@Body() dto: InfinitePayWebhookDto) {
    return this.paymentsService.handleWebhook(dto);
  }
}
