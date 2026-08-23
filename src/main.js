// Bootstrap Nest app.
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./app.module.js');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.CORS_ORIGIN || '*' });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`verso-server listening on :${port}`);
}
bootstrap();
