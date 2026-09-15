import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module';
import { isSwaggerEnabled } from './common/config/swagger.config';
import { DEFAULT_API_PORT } from './common/constants';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log('Inicializando aplicação NestJS...');

  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  // Adicionar ZodValidationPipe globalmente
  app.useGlobalPipes(new ZodValidationPipe());

  // o prefixo funciona apenas para as controllers
  // como o swagger está por fora, basta acessar apenas pelo prefixo /docs
  app.setGlobalPrefix('api');

  // Libera o frontend (Vite) a consumir a API a partir de outra origem.
  // Origens configuráveis via env CORS_ORIGINS (lista separada por vírgula):
  // assim trocar a URL do frontend no Render NÃO exige novo deploy do backend
  // — basta ajustar a env e reiniciar o serviço. Sem a env, usa os defaults
  // (dev local + serviços de frontend conhecidos no Render).
  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://marketplace-frontend-2ego.onrender.com',
      'https://marketplace-frontend-jh71.onrender.com',
    ].join(',')
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Em produção o Swagger fica desligado por padrão — o mapa completo da API
  // (endpoints, schemas de request/response, regras de permissão) não deve
  // ficar público sem uma decisão explícita do time. `SWAGGER_PUBLIC=true`
  // religa em produção (ex.: período de portfólio). Fora de produção, o
  // Swagger sempre fica disponível. Regra em `isSwaggerEnabled`, ver docs/swagger.md.
  const swaggerEnabled = isSwaggerEnabled();

  if (swaggerEnabled) {
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
          description:
            'Insira **APENAS** o token JWT gerado no login. Não digite a palavra "Bearer ".',
          in: 'header',
        },
        'bearer', // Nome do scheme de segurança, que o @ApiBearerAuth() usa por padrão
      )
      .build();

    const swaggerDocument = cleanupOpenApiDoc(SwaggerModule.createDocument(app, swaggerConfig));

    SwaggerModule.setup('docs', app, swaggerDocument);
  }

  const port = process.env.PORT ?? DEFAULT_API_PORT;

  // Importante para Docker
  await app.listen(port, '0.0.0.0');

  logger.log(`Aplicação disponível em http://localhost:${port}/api`);
  if (swaggerEnabled) {
    logger.log(`Swagger disponível em http://localhost:${port}/docs`);
  } else {
    logger.log('Swagger desligado (produção). Religue com SWAGGER_PUBLIC=true.');
  }
}

void bootstrap();
