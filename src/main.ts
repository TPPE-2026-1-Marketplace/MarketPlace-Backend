import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log('Inicializando aplicação NestJS...');

  const app = await NestFactory.create(AppModule);

  // Adicionar ZodValidationPipe globalmente
  app.useGlobalPipes(new ZodValidationPipe());

  // o prefixo funciona apenas para as controllers
  // como o swagger está por fora, basta acessar apenas pelo prefixo /docs
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API DK Fashion')
    .setDescription('Documentação da API com Swagger')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Insira **APENAS** o token JWT gerado no login. Não digite a palavra "Bearer ".',
        in: 'header',
      },
      'bearer', // Nome do scheme de segurança, que o @ApiBearerAuth() usa por padrão
    )
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
