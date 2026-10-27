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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dtos/create-address.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('addresses')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get('my')
  @ApiOperation({ summary: 'Lista os endereços da cliente autenticada (Cliente autenticado)' })
  @ApiResponse({ status: 200, description: 'Lista de endereços' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  findMy(@CurrentUser() user: CurrentUserPayload) {
    return this.addressesService.findAllByCpf(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastra um novo endereço para a cliente autenticada (Cliente autenticado)',
  })
  @ApiResponse({ status: 201, description: 'Endereço criado' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um endereço da cliente autenticada (Cliente autenticado)' })
  @ApiParam({ name: 'id', description: 'ID do endereço' })
  @ApiResponse({ status: 200, description: 'Endereço atualizado' })
  @ApiResponse({ status: 404, description: 'Endereço não encontrado' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um endereço da cliente autenticada (Cliente autenticado)' })
  @ApiParam({ name: 'id', description: 'ID do endereço' })
  @ApiResponse({ status: 204, description: 'Endereço removido' })
  @ApiResponse({ status: 404, description: 'Endereço não encontrado' })
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseIntPipe) id: number) {
    return this.addressesService.remove(id, user.sub);
  }
}
