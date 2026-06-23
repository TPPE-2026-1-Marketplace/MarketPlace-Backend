import {
  Body,
  Controller,
  Post,
  Get,
  Headers,
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
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

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

  @Post('order/:idPedido/reconcile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reconcilia o pagamento de um pedido com o gateway (Gerente/Admin)',
    description:
      'Para pedidos presos em "pending" cujo webhook não chegou: consulta o status ' +
      'atual no gateway e aplica o desfecho (paga + baixa estoque, ou cancela).',
  })
  @ApiParam({ name: 'idPedido', description: 'ID do pedido a reconciliar' })
  @ApiResponse({ status: 201, description: 'Reconciliação executada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão (requer Gerente/Admin)' })
  @ApiResponse({ status: 404, description: 'Pagamento não encontrado' })
  @ApiResponse({ status: 503, description: 'Provedor não suporta reconciliação automática' })
  reconcile(@Param('idPedido', ParseIntPipe) idPedido: number) {
    return this.paymentsService.reconcile(idPedido);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook para processamento de notificações de pagamento da InfinitePay (Público)',
    description:
      'Autenticado por segredo compartilhado no header "x-webhook-secret" ' +
      '(INFINITEPAY_WEBHOOK_SECRET). Obrigatório em produção.',
  })
  @ApiResponse({ status: 200, description: 'Webhook processado com sucesso' })
  @ApiResponse({ status: 401, description: 'Segredo do webhook ausente ou inválido' })
  @ApiResponse({ status: 404, description: 'Pagamento associado não encontrado' })
  handleWebhook(
    @Headers('x-webhook-secret') secret: string,
    @Body() dto: InfinitePayWebhookDto,
  ) {
    return this.paymentsService.handleWebhook(dto, secret);
  }
}
