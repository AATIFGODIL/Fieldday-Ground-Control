import type { MiddlewareHandler } from 'hono';

/**
 * Speed bumps for the public AI endpoints (the API key never leaves the
 * server, but the endpoints are reachable by anyone):
 *
 * - Only our own site may call them (checked on the Origin header).
 * - Each visitor gets 30 AI calls per 10 minutes, and each server instance
 *   at most 300 an hour, so a script looping on it hits a wall fast.
 * - Requests over 24 KB are refused.
 *
 * Origins can be faked and the counts are per instance, so the real ceiling
 * is the spend limit on the API key. When a request is refused the app falls
 * back as it does whenever AI is unavailable.
 */
const WINDOW_MS = 10 * 60 * 1000;
const PER_VISITOR = 30;
const PER_INSTANCE_PER_HOUR = 300;
const MAX_BODY = 24 * 1024;

const hits = new Map<string, number[]>();
let recent: number[] = [];

function allowed(origin: string): boolean {
  if (!origin) return false;
  const listed = [
    ...(process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()),
    ...[process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].map((h) => (h ? `https://${h}` : '')),
  ].filter(Boolean);
  if (listed.includes(origin)) return true;
  // This project's own Vercel domains (ground-control.vercel.app and its aliases).
  return /^https:\/\/ground-control[a-z0-9-]*\.vercel\.app$/.test(origin);
}

export const guard: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();

  if (!allowed(c.req.header('origin') ?? '')) {
    return c.json({ ok: false, reason: 'Not allowed from this site' }, 403);
  }
  const size = Number(c.req.header('content-length')) || (await c.req.raw.clone().text()).length;
  if (size > MAX_BODY) {
    return c.json({ ok: false, reason: 'Request too large' }, 413);
  }

  const visitor = (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() || c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();
  const mine = (hits.get(visitor) ?? []).filter((t) => now - t < WINDOW_MS);
  recent = recent.filter((t) => now - t < 60 * 60 * 1000);
  if (mine.length >= PER_VISITOR || recent.length >= PER_INSTANCE_PER_HOUR) {
    return c.json({ ok: false, reason: 'Too many AI requests. Try again in a few minutes.' }, 429);
  }
  mine.push(now);
  recent.push(now);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  hits.set(visitor, mine);
  await next();
};

/** CORS that only answers our own site. */
export function corsOrigin(origin: string): string | null {
  return allowed(origin) ? origin : null;
}
