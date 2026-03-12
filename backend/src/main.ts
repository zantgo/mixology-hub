import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // <-- Importa esto

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Activa la validación global automática
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Elimina propiedades que no estén en el DTO
    forbidNonWhitelisted: true, // Lanza error si envían propiedades extra
    transform: true, // Convierte los tipos automáticamente
  }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
