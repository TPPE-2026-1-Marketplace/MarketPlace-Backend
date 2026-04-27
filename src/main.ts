import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log('Inicializando aplicação NestJS...');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`Aplicação disponível em http://localhost:${port}/api`);
}

void bootstrap();
