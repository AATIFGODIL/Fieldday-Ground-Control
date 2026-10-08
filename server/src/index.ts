import 'dotenv/config';

import { serve } from '@hono/node-server';

import { buildApp } from './app';
import { warmUp } from './ai/warmup';

/** The local AI server for development (the deployed one is api/ on Vercel). */
const app = buildApp();
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`Fieldday AI server listening on http://0.0.0.0:${port}`);
  void warmUp();
});
