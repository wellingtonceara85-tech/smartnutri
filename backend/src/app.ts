import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function swaggerBasicAuth(req: Request, res: Response, next: NextFunction) {
  const user = process.env.SWAGGER_USER;
  const password = process.env.SWAGGER_PASSWORD;
  if (!user || !password) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (header?.startsWith('Basic ')) {
    const [providedUser, providedPassword] = Buffer.from(
      header.slice('Basic '.length),
      'base64',
    )
      .toString('utf-8')
      .split(':');
    if (providedUser === user && providedPassword === password) {
      next();
      return;
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="SmartNutri API Docs"');
  res.status(401).send('Autenticação necessária.');
}

export async function createNestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.use('/api/docs', swaggerBasicAuth);
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SmartNutri API')
    .setDescription(
      'API do SmartNutri — cadastro de pacientes, planos e evolução corporal para nutricionistas',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  return app;
}
