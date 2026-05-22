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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, ValidateCouponQueryDto } from './dtos/create-coupon.dto';
import { UpdateCouponDto } from './dtos/update-coupon.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastra um novo cupom de desconto (Administrador)' })
  @ApiResponse({ status: 201, description: 'Cupom cadastrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role' })
  @ApiResponse({ status: 409, description: 'Cupom com este número já existe' })
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista todos os cupons cadastrados (Administrador)' })
  @ApiResponse({ status: 200, description: 'Lista de cupons retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role' })
  findAll() {
    return this.couponsService.findAll();
  }

  @Get('by-influencer/:nome')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista todos os cupons de um influenciador/parceiro específico (Administrador)' })
  @ApiParam({ name: 'nome', description: 'Nome do influenciador/parceiro' })
  @ApiResponse({ status: 200, description: 'Lista de cupons do influenciador retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role' })
  findByInfluencer(@Param('nome') nome: string) {
    return this.couponsService.findByInfluencer(nome);
  }

  @Get('validate/:numero')
  @ApiOperation({ summary: 'Valida publicamente um cupom de desconto para aplicação em compra' })
  @ApiParam({ name: 'numero', description: 'Código do cupom' })
  @ApiQuery({
    name: 'productIds',
    required: false,
    description: 'IDs dos produtos presentes no carrinho, separados por vírgula (ex: 1,2,3)',
  })
  @ApiResponse({ status: 200, description: 'Resultado da validação do cupom' })
  validate(
    @Param('numero') numero: string,
    @Query() query: ValidateCouponQueryDto,
  ) {
    return this.couponsService.validate(numero, query.productIds);
  }

  @Patch(':numero')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza parcialmente um cupom de desconto (Administrador)' })
  @ApiParam({ name: 'numero', description: 'Código do cupom' })
  @ApiResponse({ status: 200, description: 'Cupom atualizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role' })
  @ApiResponse({ status: 404, description: 'Cupom não encontrado' })
  update(@Param('numero') numero: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(numero, dto);
  }

  @Delete(':numero')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um cupom de desconto (Administrador)' })
  @ApiParam({ name: 'numero', description: 'Código do cupom' })
  @ApiResponse({ status: 204, description: 'Cupom removido com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role' })
  @ApiResponse({ status: 404, description: 'Cupom não encontrado' })
  delete(@Param('numero') numero: string) {
    return this.couponsService.delete(numero);
  }

  @Post(':numero/products/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Associa um produto ao cupom de desconto (Administrador)' })
  @ApiParam({ name: 'numero', description: 'Código do cupom' })
  @ApiParam({ name: 'productId', description: 'ID do produto' })
  @ApiResponse({ status: 204, description: 'Produto associado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role' })
  @ApiResponse({ status: 404, description: 'Cupom ou produto não encontrado' })
  async associateProduct(
    @Param('numero') numero: string,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    await this.couponsService.associateProduct(numero, productId);
  }

  @Delete(':numero/products/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desassocia um produto do cupom de desconto (Administrador)' })
  @ApiParam({ name: 'numero', description: 'Código do cupom' })
  @ApiParam({ name: 'productId', description: 'ID do produto' })
  @ApiResponse({ status: 204, description: 'Produto desassociado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta role' })
  @ApiResponse({ status: 404, description: 'Cupom ou produto não encontrado' })
  async disassociateProduct(
    @Param('numero') numero: string,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    await this.couponsService.disassociateProduct(numero, productId);
  }
}
