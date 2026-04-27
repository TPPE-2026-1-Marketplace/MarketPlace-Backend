import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log('Inicializando aplicação NestJS...');

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API DK Fashion')
    .setDescription('Documentação da API com Swagger')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = process.env.PORT ?? 3001;

  // Importante para Docker
  await app.listen(port, '0.0.0.0');

  logger.log(`Aplicação disponível em http://localhost:${port}/api`);
  logger.log(`Swagger disponível em http://localhost:${port}/docs`);
}

void bootstrap();