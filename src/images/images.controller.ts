import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { CreateCatalogImageDto } from './dtos/create-catalog-image.dto';
import { CreateImageDto } from './dtos/create-image.dto';
import { UploadImageDto } from './dtos/upload-image.dto';
import { ImagesService } from './images.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registra uma URL de imagem manualmente' })
  @ApiResponse({ status: 201, description: 'Imagem registrada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  createImage(@Body() dto: CreateImageDto) {
    return this.imagesService.createImage(dto);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
          cb(new BadRequestException('Apenas imagens JPEG, PNG, GIF e WEBP são permitidas.'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  @ApiOperation({ summary: 'Faz upload de uma imagem para o ImgBB e salva a URL no banco' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Arquivo de imagem (JPEG, PNG, GIF, WEBP — máx 5MB)' },
        ordem: { type: 'integer', description: 'Ordem de exibição padrão' },
        descricao: { type: 'string', description: 'Descrição alternativa da imagem' },
        local_renderizacao: { type: 'string', description: 'Local onde a imagem será exibida (ex: banner, miniatura)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Imagem enviada ao ImgBB e registrada com sucesso' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido ou erro no ImgBB' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadImageDto,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo de imagem foi enviado.');
    }
    return this.imagesService.uploadAndCreateImage(file, dto);
  }

  @Post('catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE, Role.ADMINISTRADOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vincula uma imagem a uma variante de produto' })
  @ApiResponse({ status: 201, description: 'Imagem vinculada ao catálogo' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 404, description: 'Imagem ou variante não encontrada' })
  linkImageToVariant(@Body() dto: CreateCatalogImageDto) {
    return this.imagesService.linkImageToVariant(dto);
  }

  @Get('catalog/:variantSku')
  @ApiOperation({ summary: 'Lista imagens de catálogo de uma variante' })
  @ApiParam({ name: 'variantSku', type: String })
  @ApiResponse({ status: 200, description: 'Imagens de catálogo da variante' })
  @ApiResponse({ status: 404, description: 'Variante não encontrada' })
  findCatalogByVariantSku(@Param('variantSku') variantSku: string) {
    return this.imagesService.findCatalogByVariantSku(variantSku);
  }
}
