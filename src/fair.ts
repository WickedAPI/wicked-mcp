// Fair-use plumbing for the public HTTP deployment: who is calling (per request), a small TTL cache so
// repeated questions cost nothing upstream, a per-client daily cap on the one tool family with a real
// per-call vendor cost (Sanity open mode runs a paid web search per claim), and aggregate counters.
// Counters hold counts only: no IPs, claims, wallets or results. In-memory like the rate limiter.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";

const clientStore = new AsyncLocalStorage<string>();

/** Run `fn` with the caller's rate-limit key attached, so tool handlers can apply per-client limits. */
export function withClient<T>(key: string, fn: () => T): T {
  noteClient(key);
  return clientStore.run(key, fn);
}

export function currentClient(): string | undefined {
  return clientStore.getStore();
}

// ---- TTL cache (bounded, oldest-first eviction) ---------------------------------------------------
const MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 2000);
const cache = new Map<string, { exp: number; value: unknown }>();
const stats = { cache_hits: 0, cache_misses: 0, open_mode_refused: 0 };

export function cacheGet<T>(key: string, now = Date.now()): T | undefined {
  const e = cache.get(key);
  if (!e || e.exp <= now) {
    if (e) cache.delete(key);
    stats.cache_misses++;
    return undefined;
  }
  stats.cache_hits++;
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number, now = Date.now()): void {
  if (ttlMs <= 0) return;
  if (cache.size >= MAX_ENTRIES) {
    for (const [k, v] of cache) if (v.exp <= now) cache.delete(k);
    while (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, { exp: now + ttlMs, value });
}

export const cacheKeyOf = (...parts: unknown[]): string =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");

// ---- per-client daily cap on open-mode (paid web search) claims ------------------------------------
const OPEN_PER_CLIENT_PER_DAY = () => Number(process.env.OPEN_MODE_PER_CLIENT_PER_DAY || 5);
const day = { key: "", open: new Map<string, number>(), clients: new Set<string>() };
const salt = randomBytes(8).toString("hex"); // per-process: unique-client counts cannot be reversed or linked across restarts

function rollDay(now = Date.now()) {
  const k = new Date(now).toISOString().slice(0, 10);
  if (day.key !== k) {
    day.key = k;
    day.open.clear();
    day.clients.clear();
  }
}

function noteClient(key: string) {
  rollDay();
  day.clients.add(createHash("sha256").update(salt + key).digest("hex").slice(0, 16));
}

/** Reserve `claims` open-mode claims for this client today. Returns null if allowed, else a refusal body. */
export function reserveOpenMode(claims: number, client = currentClient()): Record<string, unknown> | null {
  rollDay();
  const cap = OPEN_PER_CLIENT_PER_DAY();
  if (!client || cap <= 0) return null;
  const used = day.open.get(client) ?? 0;
  if (used + claims > cap) {
    stats.open_mode_refused++;
    return {
      http_status: 429,
      error: `Open-mode checks are limited to ${cap} claims per client per day on this shared server (each one runs a paid live web search). Grounded mode (pass your source text as context) is not limited this way.`,
      hint: "Use mode \"grounded\" with a context, set your own SANITY_API_KEY, pay per call over x402, or run the MCP server locally.",
      remaining_today: Math.max(0, cap - used),
      source: "mcp",
    };
  }
  day.open.set(client, used + claims);
  return null;
}

export function fairSnapshot() {
  rollDay();
  return { day: day.key, unique_clients_today: day.clients.size, ...stats, cache_entries: cache.size };
}

export function _resetFairForTests() {
  cache.clear();
  day.key = "";
  day.open.clear();
  day.clients.clear();
  stats.cache_hits = stats.cache_misses = stats.open_mode_refused = 0;
}
