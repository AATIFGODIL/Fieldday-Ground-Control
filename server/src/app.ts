import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { z } from 'zod';

import {
  BriefRequest,
  PlacementRequest,
  RelatedCheckRequest,
  StaffingRequest,
  StructureIncidentRequest,
  SuggestResponseRequest,
  type AIResult,
} from '../../src/domain/ai-contracts';

import { chaosFrom, type Chaos } from './ai/call-ai';
import { brief, placement, relatedCheck, staffing, structureIncident, suggestResponse } from './ai/endpoints';
import { corsOrigin, guard } from './guard';

/**
 * The AI routes. Locally they're served as-is by index.ts; on Vercel they
 * live under /api and sit behind the guard (our site only, rate-limited).
 */
export function buildApp({ basePath = '', guarded = false }: { basePath?: string; guarded?: boolean } = {}) {
  const app = new Hono().basePath(basePath);
  app.use('*', logger());
  app.use('*', cors(guarded ? { origin: (o) => corsOrigin(o) } : undefined));

  app.get('/health', (c) => c.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) }));

  if (guarded) app.use('/ai/*', guard);

  /** Validate the request body, run the AI call, always answer with an AIResult. */
  function route<S extends z.ZodType, T>(path: string, schema: S, handler: (body: z.infer<S>, chaos: Chaos) => Promise<AIResult<T>>) {
    app.post(path, async (c) => {
      const raw = await c.req.json().catch(() => null);
      const body = schema.safeParse(raw);
      if (!body.success) {
        return c.json({ ok: false, reason: `bad request: ${body.error.message.slice(0, 300)}` }, 400);
      }
      const result = await handler(body.data, chaosFrom(c.req.header('x-ai-chaos')));
      return c.json(result);
    });
  }

  route('/ai/structure-incident', StructureIncidentRequest, structureIncident);
  route('/ai/suggest-response', SuggestResponseRequest, suggestResponse);
  route('/ai/related-check', RelatedCheckRequest, relatedCheck);
  route('/ai/brief', BriefRequest, brief);
  route('/ai/placement', PlacementRequest, placement);
  route('/ai/staffing', StaffingRequest, staffing);

  return app;
}
