import cors from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { citiesRoutes } from './api/cities';
import { countriesRoutes } from './api/countries';
import { statesRoutes } from './api/states';
import { API_VERSION } from './config/api';
import copies from './utils/copies';

new Elysia()
  .use(cors())
  .group(`/${API_VERSION}`, (app) =>
    app
      .use(countriesRoutes)
      .use(statesRoutes)
      .use(citiesRoutes)
      .get('/health', () => ({ status: 'ok' }))
  )
  .listen(process.env.PORT ? parseInt(process.env.PORT) : 3000);

console.info(copies.API_RUNNING_ON_PORT);
