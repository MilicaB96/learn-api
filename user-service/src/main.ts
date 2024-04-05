// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
import { HttpStatus } from '@nestjs/common';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(3000);
// }
// bootstrap();
export async function healthcheck() {
  // const app = await NestFactory.create(AppModule);
  return {
    statusCode: HttpStatus.OK,
    body: JSON.stringify('All good'),
  };
}
