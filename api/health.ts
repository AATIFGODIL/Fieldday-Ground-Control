import { handler } from '../server/src/vercel';

/** GET /api/health: is the server up, and does it have a key? */
export const GET = handler;
