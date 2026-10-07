import 'dotenv/config';

import { serve } from '@hono/node-server';
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
import { warmUp } from './ai/warmup';

const app = new Hono();
app.use('*', logger());
app.use('*', cors());

app.get('/health', (c) =>
  c.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) }),
);

/** Validate the request body, run the AI call, always answer with an AIResult. */
function route<S extends z.ZodType, T>(
  path: string,
  schema: S,
  handler: (body: z.infer<S>, chaos: Chaos) => Promise<AIResult<T>>,
) {
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

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`Fieldday AI server listening on http://0.0.0.0:${port}`);
  void warmUp();
});
