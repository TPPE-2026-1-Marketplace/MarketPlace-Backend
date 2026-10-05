import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check da API (sem autenticação)' })
  @ApiResponse({ status: 200, description: 'API no ar' })
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check da API e do banco de dados' })
  @ApiResponse({ status: 200, description: 'API pronta para receber tráfego' })
  @ApiResponse({ status: 503, description: 'API ainda não está pronta' })
  async ready(): Promise<{ status: string; timestamp: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Serviço temporariamente indisponível');
    }
  }
}
