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
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria uma nova avaliação de produto pelo cliente autenticado' })
  @ApiResponse({ status: 201, description: 'Avaliação criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Cliente ou Produto não encontrado' })
  @ApiResponse({ status: 409, description: 'O cliente já avaliou este produto' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReviewDto,
  ) {
    // id_cliente capturado do token (user.sub), não do payload
    return this.reviewsService.create(user.sub, dto);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Busca as avaliações de um produto por ID (paginado)' })
  @ApiParam({ name: 'productId', description: 'ID do produto' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Lista paginada de avaliações, contendo média e total geral.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  findByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() query: QueryPaginationDto,
  ) {
    return this.reviewsService.findByProductPaginated(
      productId,
      query.page,
      query.limit,
    );
  }

  @Delete(':clienteId/:produtoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma avaliação inadequada (Gerente/Administrador)' })
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
