import { ReplitConnectors } from "@replit/connectors-sdk";

let _connectors: ReplitConnectors | null = null;

function getConnectors(): ReplitConnectors {
  if (!_connectors) _connectors = new ReplitConnectors();
  return _connectors;
}

async function rcFetch(path: string, options?: { method?: string; body?: unknown }): Promise<unknown> {
  const connectors = getConnectors();
  const method = options?.method ?? "GET";
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;

  const resp = await connectors.proxy("revenuecat", path, {
    method,
    body,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });

  const text = await resp.text();
  if (!resp.ok) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { error: parsed };
  }

  if (!text) return { data: null };
  try { return { data: JSON.parse(text) }; } catch { return { data: text }; }
}

type RcResult<T> = Promise<{ data: T; error?: undefined } | { data?: undefined; error: unknown }>;

export const rc = {
  get: <T>(path: string): RcResult<T> => rcFetch(path) as RcResult<T>,
  post: <T>(path: string, body: unknown): RcResult<T> => rcFetch(path, { method: "POST", body }) as RcResult<T>,
  patch: <T>(path: string, body: unknown): RcResult<T> => rcFetch(path, { method: "PATCH", body }) as RcResult<T>,
  delete: <T>(path: string): RcResult<T> => rcFetch(path, { method: "DELETE" }) as RcResult<T>,
};
