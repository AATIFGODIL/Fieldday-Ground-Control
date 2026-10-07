import Constants from 'expo-constants';

import type {
  AIResult,
  BriefRequest,
  BriefResult,
  PlacementRequest,
  PlacementResult,
  RelatedCheckRequest,
  RelatedCheckResult,
  StructureIncidentRequest,
  StructuredIncident,
  SuggestResponseRequest,
  SuggestedResponse,
} from '@/domain/ai-contracts';
import { useStore } from '@/state/store';

/**
 * The AI backend. The API key lives on the server only; the app never sees it.
 * Defaults to port 8787 on the same host as the Metro dev server.
 */
export function apiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:8787`;
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<AIResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const chaos = useStore.getState().aiChaos;
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(chaos !== 'off' ? { 'x-ai-chaos': chaos } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json()) as AIResult<T>;
    if (typeof json !== 'object' || json === null || typeof json.ok !== 'boolean') {
      return { ok: false, reason: 'Malformed server response' };
    }
    return json;
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return { ok: false, reason: aborted ? 'AI server did not respond in time' : 'AI server unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

// Client timeouts sit a little above the server's own model timeouts.
export const api = {
  structureIncident: (b: StructureIncidentRequest) => post<StructuredIncident>('/ai/structure-incident', b, 18_000),
  suggestResponse: (b: SuggestResponseRequest) => post<SuggestedResponse>('/ai/suggest-response', b, 23_000),
  relatedCheck: (b: RelatedCheckRequest) => post<RelatedCheckResult>('/ai/related-check', b, 13_000),
  brief: (b: BriefRequest) => post<BriefResult>('/ai/brief', b, 18_000),
  placement: (b: PlacementRequest) => post<PlacementResult>('/ai/placement', b, 35_000),
  health: async (): Promise<{ ok: boolean; hasKey?: boolean }> => {
    try {
      const res = await fetch(`${apiBaseUrl()}/health`);
      return (await res.json()) as { ok: boolean; hasKey?: boolean };
    } catch {
      return { ok: false };
    }
  },
};
