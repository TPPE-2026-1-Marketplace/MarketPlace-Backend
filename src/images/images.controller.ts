import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateCatalogImageDto } from './dtos/create-catalog-image.dto';
import { CreateImageDto } from './dtos/create-image.dto';
import { ImagesService } from './images.service';

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @ApiOperation({ summary: 'Registra uma URL de imagem' })
  @ApiResponse({ status: 201, description: 'Imagem registrada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  createImage(@Body() dto: CreateImageDto) {
    return this.imagesService.createImage(dto);
  }

  @Post('catalog')
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
