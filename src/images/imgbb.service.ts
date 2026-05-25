import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';

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
    this.apiKey = this.configService.get<string>('IMGBB_API_KEY') ?? '';
  }

  async uploadImage(file: Express.Multer.File): Promise<ImgBBResponse> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'IMGBB_API_KEY não configurada nas variáveis de ambiente.',
      );
    }
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
      // Erros que nós mesmos lançamos (ex.: success=false) já são HttpException —
      // repassa sem reembrulhar num 500 genérico.
      if (error instanceof HttpException) {
        throw error;
      }
      if (axios.isAxiosError(error) && error.response) {
        throw new BadRequestException(
          `Erro na API do ImgBB: ${error.response.data?.error?.message ?? error.message}`,
        );
      }
      throw new InternalServerErrorException('Erro ao se comunicar com o ImgBB.');
    }
  }
}
