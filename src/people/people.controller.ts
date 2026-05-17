import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CreatePersonDto } from './dtos/create-person.dto';
import { UpdatePersonDto } from './dtos/update-person.dto';
import { PeopleService } from './people.service';

/**
 * Schema de paginação local. Será movido para `src/common/` em D2, quando
 * mais módulos passarem a reusá-lo. `z.coerce.number()` é importante porque
 * query params chegam sempre como string.
 */
const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
class PaginationDto extends createZodDto(PaginationSchema) { }

@ApiTags('people')
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) { }

  /**
   * IMPORTANTE: este endpoint é o CRUD genérico de pessoas, sem guard nesta
   * issue (#33). A versão pública para auto-cadastro de cliente
   * (`POST /people/register`) e o cadastro restrito ao caixa (`POST /people`
   * com guard) entram na issue de D2.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria uma nova pessoa (CRUD básico)' })
  @ApiResponse({ status: 201, description: 'Pessoa criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 409, description: 'CPF ou email já cadastrado' })
  create(@Body() dto: CreatePersonDto) {
    return this.peopleService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista pessoas com paginação' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista paginada de pessoas' })
  findAll(@Query() query: PaginationDto) {
    return this.peopleService.findAll(query.page, query.limit);
  }

  @Get(':cpf')
  @ApiOperation({ summary: 'Busca uma pessoa por CPF' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Pessoa encontrada' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  findOne(@Param('cpf') cpf: string) {
    return this.peopleService.findOne(cpf);
  }

  @Patch(':cpf')
  @ApiOperation({ summary: 'Atualiza dados de uma pessoa' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 200, description: 'Pessoa atualizada' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado por outra pessoa' })
  update(@Param('cpf') cpf: string, @Body() dto: UpdatePersonDto) {
    return this.peopleService.update(cpf, dto);
  }

  @Delete(':cpf')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma pessoa' })
  @ApiParam({ name: 'cpf', description: 'CPF (11 dígitos sem máscara)' })
  @ApiResponse({ status: 204, description: 'Pessoa removida' })
  @ApiResponse({ status: 404, description: 'Pessoa não encontrada' })
  remove(@Param('cpf') cpf: string) {
    return this.peopleService.remove(cpf);
  }
}
