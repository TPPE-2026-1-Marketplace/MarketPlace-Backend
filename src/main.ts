import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  app.enableCors();

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('MarketPlace Backend API')
    .setDescription(
      'Party dress e-commerce and ERP system — REST API documentation',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Products', 'Product catalog with dress measurements')
    .addTag('Inventory', 'Stock management and audit logs')
    .addTag('Sales', 'Sales and commission tracking')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap().catch(console.error);
