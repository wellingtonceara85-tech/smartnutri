import { config } from 'dotenv';
import { createNestApp } from './app';

config({ path: '.env.dev' });

async function bootstrap() {
  const app = await createNestApp();
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
void bootstrap();
