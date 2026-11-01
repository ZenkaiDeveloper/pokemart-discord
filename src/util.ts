/** Shared helpers for the PokeMart Discord Worker. */

export const SITE = "https://pokemart.online";
export const ATTRIBUTION = "Data: PokeMart (pokemart.online)";
export const CAPTURE_NOTE =
  "Ended-auction Browse proxies (last bid before close), not confirmed solds.";

export type Env = {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID?: string;
  DISCORD_BOT_TOKEN?: string;
  STATIC_BASE?: string;
  BOT_SHOW_IMAGES?: string;
  CACHE_TTL_SECONDS?: string;
  DEFER_AFTER_MS?: string;
};

export function staticBase(env: Env): string {
  return (env.STATIC_BASE || SITE).replace(/\/$/, "");
}

export function showImages(env: Env): boolean {
  return String(env.BOT_SHOW_IMAGES || "false").toLowerCase() === "true";
}

export function cacheTtl(env: Env): number {
  const n = Number(env.CACHE_TTL_SECONDS || "3600");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3600) : 3600;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  if (clean.length % 2 !== 0) throw new Error("odd hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function usdFromCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function absUrl(env: Env, path: string): string {
  if (!path) return staticBase(env);
  if (/^https?:\/\//i.test(path)) return path;
  return `${staticBase(env)}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function loadJson<T = unknown>(
  env: Env,
  path: string,
): Promise<T | null> {
  const url = absUrl(env, path);
  const ttl = cacheTtl(env);
  const cache = caches.default;
  const cacheKey = new Request(url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) {
    try {
      return (await hit.clone().json()) as T;
    } catch {
      /* fall through */
    }
  }
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "pokemart-discord/1.0" },
  });
  if (!res.ok) return null;
  const body = await res.arrayBuffer();
  const out = new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttl}`,
    },
  });
  try {
    await cache.put(cacheKey, out.clone());
  } catch {
    /* ignore cache put failures */
  }
  return JSON.parse(new TextDecoder().decode(body)) as T;
}

export async function loadText(env: Env, path: string): Promise<string | null> {
  const url = absUrl(env, path);
  const ttl = cacheTtl(env);
  const cache = caches.default;
  const cacheKey = new Request(url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit.text();
  const res = await fetch(url, {
    headers: { Accept: "text/csv,text/plain,*/*", "User-Agent": "pokemart-discord/1.0" },
  });
  if (!res.ok) return null;
  const text = await res.text();
  try {
    await cache.put(
      cacheKey,
      new Response(text, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": `public, max-age=${ttl}`,
        },
      }),
    );
  } catch {
    /* ignore */
  }
  return text;
}
