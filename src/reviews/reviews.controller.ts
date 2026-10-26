import {
  Body,
  Controller,
  Delete,
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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateReviewDto, QueryPaginationDto } from './dtos/create-review.dto';
import { UpdateReviewDto } from './dtos/update-review.dto';
import { ReviewsService } from './reviews.service';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria uma nova avaliação de produto pelo cliente autenticado (Cliente autenticado)',
  })
  @ApiResponse({ status: 201, description: 'Avaliação criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Cliente ou Produto não encontrado' })
  @ApiResponse({ status: 409, description: 'O cliente já avaliou este produto' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateReviewDto) {
    // id_cliente capturado do token (user.sub), não do payload
    return this.reviewsService.create(user.sub, dto);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Busca as avaliações de um produto por ID (paginado) (Público)' })
  @ApiParam({ name: 'productId', description: 'ID do produto' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de avaliações, contendo média e total geral.',
  })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  findByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() query: QueryPaginationDto,
  ) {
    return this.reviewsService.findByProductPaginated(productId, query.page, query.limit);
  }

  @Get('product/:productId/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Retorna a avaliação do cliente no produto e se ele pode avaliá-lo (Cliente autenticado)',
  })
  @ApiParam({ name: 'productId', description: 'ID do produto' })
  @ApiResponse({
    status: 200,
    description:
      '`{ avaliacao, podeAvaliar, motivo }`, com `avaliacao` nula se o cliente ainda não avaliou e `motivo` em PODE_AVALIAR, JA_AVALIOU ou SEM_COMPRA_VERIFICADA.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  findMine(
    @CurrentUser() user: CurrentUserPayload,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.reviewsService.findMine(user.sub, productId);
  }

  @Patch('product/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Edita a nota e/ou o comentário da própria avaliação (Cliente autenticado)',
  })
  @ApiParam({ name: 'productId', description: 'ID do produto avaliado' })
  @ApiResponse({
    status: 200,
    description: 'Avaliação atualizada, com `dataEdicao` preenchida e média/total recalculados',
  })
  @ApiResponse({ status: 400, description: 'Corpo vazio ou dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Avaliação não encontrada' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(user.sub, productId, dto);
  }

  // Declarada antes de ':clienteId/:produtoId': o Express casa as rotas na ordem de
  // registro, e 'product/:productId' também casaria com aquele padrão (403 de gerente).
  @Delete('product/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a própria avaliação do produto (Cliente autenticado)' })
  @ApiParam({ name: 'productId', description: 'ID do produto avaliado' })
  @ApiResponse({ status: 204, description: 'Avaliação removida com sucesso (Hard Delete)' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Avaliação não encontrada' })
  removeMine(
    @CurrentUser() user: CurrentUserPayload,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.reviewsService.remove(user.sub, productId);
  }

  @Delete(':clienteId/:produtoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma avaliação inadequada (Gerente ou administrador)' })
  @ApiParam({ name: 'clienteId', description: 'CPF do cliente que realizou a avaliação' })
  @ApiParam({ name: 'produtoId', description: 'ID do produto avaliado' })
  @ApiResponse({ status: 204, description: 'Avaliação removida com sucesso (Hard Delete)' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role' })
  @ApiResponse({ status: 404, description: 'Avaliação não encontrada' })
  remove(
    @Param('clienteId') clienteId: string,
    @Param('produtoId', ParseIntPipe) produtoId: number,
  ) {
    return this.reviewsService.remove(clienteId, produtoId);
  }
}
