import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require('form-data') as typeof import('form-data');

export interface ImgBBResponse {
  url: string;
  display_url: string;
  delete_url: string;
  title: string;
}

@Injectable()
export class ImgbbService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.imgbb.com/1/upload';

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('IMGBB_API_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'IMGBB_API_KEY não configurada nas variáveis de ambiente.',
      );
    }
    this.apiKey = key;
  }

  async uploadImage(file: Express.Multer.File): Promise<ImgBBResponse> {
    const form = new FormData();
    form.append('key', this.apiKey);
    form.append('image', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    try {
      const response = await axios.post<{
        data: {
          url: string;
          display_url: string;
          delete_url: string;
          title: string;
        };
        success: boolean;
      }>(this.apiUrl, form, {
        headers: form.getHeaders(),
      });

      if (!response.data.success) {
        throw new BadRequestException('Falha ao enviar imagem para o ImgBB.');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new BadRequestException(
          `Erro na API do ImgBB: ${error.response.data?.error?.message ?? error.message}`,
        );
      }
      throw new InternalServerErrorException('Erro ao se comunicar com o ImgBB.');
    }
  }
}
