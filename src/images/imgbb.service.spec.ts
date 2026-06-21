import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

import { ImgbbService } from './imgbb.service';

import type { ConfigService } from '@nestjs/config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const file = {
  buffer: Buffer.from('fake-image'),
  originalname: 'foto.png',
  mimetype: 'image/png',
} as Express.Multer.File;

function makeService(apiKey: string | undefined): ImgbbService {
  const configService = { get: jest.fn().mockReturnValue(apiKey) } as unknown as ConfigService;
  return new ImgbbService(configService);
}

describe('ImgbbService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lança InternalServerError quando IMGBB_API_KEY não está configurada', async () => {
    const service = makeService(undefined);
    await expect(service.uploadImage(file)).rejects.toThrow(InternalServerErrorException);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('retorna os dados do ImgBB no caminho de sucesso', async () => {
    const service = makeService('chave-valida');
    const imgbbData = {
      url: 'https://i.ibb.co/abc/foto.png',
      display_url: 'https://i.ibb.co/abc/foto.png',
      delete_url: 'https://ibb.co/del/xyz',
      title: 'foto',
    };
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true, data: imgbbData } });

    await expect(service.uploadImage(file)).resolves.toEqual(imgbbData);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('lança BadRequest quando o ImgBB responde success=false', async () => {
    const service = makeService('chave-valida');
    mockedAxios.post.mockResolvedValueOnce({ data: { success: false } });

    await expect(service.uploadImage(file)).rejects.toThrow(BadRequestException);
  });

  it('lança BadRequest com a mensagem do ImgBB quando o axios retorna erro de resposta', async () => {
    const service = makeService('chave-valida');
    const axiosError = {
      response: { data: { error: { message: 'arquivo grande demais' } } },
      message: 'Request failed',
    };
    mockedAxios.post.mockRejectedValueOnce(axiosError);
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(service.uploadImage(file)).rejects.toThrow(/arquivo grande demais/);
  });

  it('lança InternalServerError quando o erro não é do axios', async () => {
    const service = makeService('chave-valida');
    mockedAxios.post.mockRejectedValueOnce(new Error('boom'));
    mockedAxios.isAxiosError.mockReturnValue(false);

    await expect(service.uploadImage(file)).rejects.toThrow(InternalServerErrorException);
  });
});
