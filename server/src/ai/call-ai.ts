import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

import type { AIResult } from '../../../src/domain/ai-contracts';

export const HAIKU = 'claude-haiku-4-5-20251001';
export const SONNET = 'claude-sonnet-5-5';

const client = new Anthropic({ maxRetries: 1 });

interface CallOptions<S extends z.ZodType> {
  name: string;
  model: typeof HAIKU | typeof SONNET;
  system: string;
  user: string;
  schema: S;
  /** Cross-reference checks the schema can't express. Return a reason string to reject. */
  check?: (out: z.infer<S>) => string | null;
  timeoutMs: number;
  maxTokens: number;
  /** Sonnet only. */
  effort?: 'low' | 'medium' | 'high';
  /** Demo/testing: force a failure mode to exercise the fallback paths. */
  chaos?: Chaos;
}

export type Chaos = 'timeout' | 'junk' | null;

export function chaosFrom(header: string | undefined): Chaos {
  if (process.env.NODE_ENV === 'production') return null;
  return header === 'timeout' || header === 'junk' ? header : null;
}

/**
 * Every AI call goes through here. Failure is a designed path: timeouts, API
 * errors, refusals, unparseable output and semantically invalid output all
 * come back as `{ ok: false, reason }` and the app falls back to a human path.
 */
export async function callAI<S extends z.ZodType>(opts: CallOptions<S>): Promise<AIResult<z.infer<S>>> {
  const started = Date.now();
  const fail = (reason: string): AIResult<z.infer<S>> => {
    console.warn(`[ai:${opts.name}] FAILED after ${Date.now() - started}ms — ${reason}`);
    return { ok: false, reason };
  };

  const system = [{ type: 'text' as const, text: opts.system, cache_control: { type: 'ephemeral' as const } }];
  const messages = [{ role: 'user' as const, content: opts.user }];
  const timeoutMs = opts.chaos === 'timeout' ? 1 : opts.timeoutMs;
  const requestOptions = { signal: AbortSignal.timeout(timeoutMs), timeout: timeoutMs };

  let parsed: unknown;
  let stopReason: string | null | undefined;
  try {
    if (opts.model === SONNET) {
      const res = await client.beta.messages.parse(
        {
          model: SONNET,
          max_tokens: opts.maxTokens,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: opts.effort ?? 'low', format: betaZodOutputFormat(opts.schema) },
          system,
          messages,
        },
        requestOptions,
      );
      stopReason = res.stop_reason;
      parsed = res.parsed_output;
    } else {
      const res = await client.messages.parse(
        {
          model: HAIKU,
          max_tokens: opts.maxTokens,
          output_config: { format: zodOutputFormat(opts.schema) },
          system,
          messages,
        },
        requestOptions,
      );
      stopReason = res.stop_reason;
      parsed = res.parsed_output;
    }
  } catch (err) {
    if (
      err instanceof Anthropic.APIUserAbortError ||
      err instanceof Anthropic.APIConnectionTimeoutError ||
      (err instanceof Error && err.name === 'TimeoutError')
    ) {
      return fail(`timed out after ${timeoutMs}ms`);
    }
    if (err instanceof Anthropic.AuthenticationError) return fail('authentication failed (check ANTHROPIC_API_KEY)');
    if (err instanceof Anthropic.RateLimitError) return fail('rate limited');
    if (err instanceof Anthropic.APIError) return fail(`API error ${err.status ?? ''}: ${err.message}`);
    const message = err instanceof Error ? err.message : String(err);
    if (/authentication method|apiKey/i.test(message)) return fail('AI is not configured on the server (no API key)');
    return fail(`unparseable or unexpected response: ${message}`);
  }

  if (stopReason === 'refusal') return fail('model declined');
  if (stopReason === 'max_tokens') return fail('response truncated');
  if (opts.chaos === 'junk') parsed = { garbage: true, note: 'chaos: junk response' };

  const result = opts.schema.safeParse(parsed);
  if (!result.success) return fail(`schema mismatch: ${result.error.message.slice(0, 200)}`);

  const problem = opts.check?.(result.data);
  if (problem) return fail(`semantic check: ${problem}`);

  console.log(`[ai:${opts.name}] ok in ${Date.now() - started}ms`);
  return { ok: true, data: result.data };
}
