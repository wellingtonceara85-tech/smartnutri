import { onRequest } from 'firebase-functions/v2/https';
import { createNestApp } from './app';

type ExpressHandler = (req: unknown, res: unknown) => void;

let cachedHandler: ExpressHandler | undefined;

async function getHandler(): Promise<ExpressHandler> {
  if (!cachedHandler) {
    const app = await createNestApp();
    await app.init();
    cachedHandler = app.getHttpAdapter().getInstance() as ExpressHandler;
  }
  return cachedHandler;
}

export const api = onRequest(
  {
    region: 'southamerica-east1',
    invoker: 'public',
    secrets: [
      'DATABASE_URL',
      'DIRECT_DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'STORAGE_ACCESS_KEY_ID',
      'STORAGE_SECRET_ACCESS_KEY',
    ],
  },
  async (req, res) => {
    const handler = await getHandler();
    handler(req, res);
  },
);
