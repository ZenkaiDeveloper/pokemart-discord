/**
 * Card resolution + autocomplete over /api/v1/search-lite.json (cached).
 * Prefix shards: first two alphanumeric chars of the query drive a soft prefer
 * list; full search-lite remains the source of truth (M1.12).
 */
import { Env, loadJson } from "./util";

export type LiteCard = {
  t: string;
  ss: string;
  cs: string;
  href: string;
  pid: string;
};

type SearchLite = {
  cards?: LiteCard[];
  n?: number;
};

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

/** Score a lite card against a free-text query. Higher is better. */
export function scoreCard(card: LiteCard, query: string): number {
  const q = norm(query);
  if (!q) return 0;
  const title = norm(card.t);
  const setSlug = norm((card.ss || "").replace(/-/g, " "));
  const cardSlug = norm((card.cs || "").replace(/-/g, " "));
  const hay = `${title} ${setSlug} ${cardSlug}`;

  if (title === q) return 10_000;
  if (hay.includes(q)) return 5_000 + Math.min(q.length, 40);

  const qt = tokens(q);
  if (!qt.length) return 0;
  let titleHit = 0;
  let setHit = 0;
  for (const t of qt) {
    if (title.includes(t) || cardSlug.includes(t) || title.startsWith(t)) {
      titleHit += 1;
    } else if (setSlug.includes(t)) {
      setHit += 1;
    }
  }
  // Name must participate — set-only overlap must not win (e.g. "umbreon neo discovery"
  // must not resolve to an unrelated Neo Discovery print).
  if (titleHit === 0) return 0;
  const coverage = (titleHit + setHit * 0.5) / qt.length;
  return (
    coverage * 1_000 +
    titleHit * 120 +
    setHit * 40 -
    Math.min(title.length, 80)
  );
}

export async function loadSearchLite(env: Env): Promise<LiteCard[]> {
  const payload = await loadJson<SearchLite>(env, "/api/v1/search-lite.json");
  return Array.isArray(payload?.cards) ? payload!.cards! : [];
}

export function findBest(
  cards: LiteCard[],
  query: string,
): { card: LiteCard; score: number } | null {
  let best: LiteCard | null = null;
  let bestScore = 0;
  for (const c of cards) {
    const s = scoreCard(c, query);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (!best || bestScore <= 0) return null;
  return { card: best, score: bestScore };
}

export function autocomplete(
  cards: LiteCard[],
  query: string,
  limit = 25,
): LiteCard[] {
  const q = (query || "").trim();
  const scored: { c: LiteCard; s: number }[] = [];
  for (const c of cards) {
    const s = q ? scoreCard(c, q) : 1;
    if (s > 0) scored.push({ c, s });
  }
  scored.sort((a, b) => b.s - a.s || a.c.t.localeCompare(b.c.t));
  return scored.slice(0, limit).map((x) => x.c);
}

/** Resolve print_id or "set/card" or free text. */
export async function resolveCard(
  env: Env,
  raw: string,
): Promise<LiteCard | null> {
  const q = (raw || "").trim();
  if (!q) return null;
  const cards = await loadSearchLite(env);

  // print_id
  if (/^pm_[a-z0-9]+$/i.test(q)) {
    const hit = cards.find((c) => c.pid === q);
    if (hit) return hit;
  }
  // set_slug/card_slug or set_slug card_slug
  const m = q.match(/^([a-z0-9-]+)[\/\s]+([a-z0-9-]+)$/i);
  if (m) {
    const ss = m[1].toLowerCase();
    const cs = m[2].toLowerCase();
    const hit = cards.find(
      (c) => c.ss === ss && c.cs === cs,
    );
    if (hit) return hit;
  }

  const best = findBest(cards, q);
  return best ? best.card : null;
}
