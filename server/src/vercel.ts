import { handle } from 'hono/vercel';

import { buildApp } from './app';

/** The AI routes as a Vercel function: under /api, behind the guard. */
export const handler = handle(buildApp({ basePath: '/api', guarded: true }));
