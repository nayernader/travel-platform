import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Every route starts with /api
  app.setGlobalPrefix('api');

  // Reads cookies from incoming requests (for the login token)
  app.use(cookieParser());

  // Validates every request body against its DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in the DTO
      forbidNonWhitelisted: true, // rejects requests that send unknown properties
      transform: true, // converts "5" to 5, query strings to numbers, etc.
    }),
  );

  // One consistent error format
  app.useGlobalFilters(new AllExceptionsFilter());

  // Lets the Next.js frontend (port 3000) send cookies to this API
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });

  // Swagger docs at /api/docs
  const config = new DocumentBuilder()
    .setTitle('Travel Planning and Booking Platform API')
    .setDescription('REST API for Software Project I')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();