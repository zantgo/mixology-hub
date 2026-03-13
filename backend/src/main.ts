import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // <-- Importa esto

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('MixologyHub API')
    .setDescription('Official API to manage cocktails and recipes with AI')
    .setVersion('1.0')
    .addTag('Cocktails')
    .addTag('Ingredients')
    .addTag('AI')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, documentFactory);
  // --------------------------------

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
