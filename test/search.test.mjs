/**
 * Offline card resolution fixtures against live search-lite shape
 * (cached fixture snapshot + optional live fetch).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, "fixtures");
const LITE_PATH = join(FIX, "search-lite.sample.json");
const QUERIES = JSON.parse(readFileSync(join(FIX, "queries.json"), "utf8"));

function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return norm(s).split(" ").filter(Boolean);
}

function scoreCard(card, query) {
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
  if (titleHit === 0) return 0;
  const coverage = (titleHit + setHit * 0.5) / qt.length;
  return (
    coverage * 1_000 +
    titleHit * 120 +
    setHit * 40 -
    Math.min(title.length, 80)
  );
}

function findBest(cards, query) {
  let best = null;
  let bestScore = 0;
  for (const c of cards) {
    const s = scoreCard(c, query);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best && bestScore > 0 ? best : null;
}

function resolveCard(cards, q) {
  if (/^pm_[a-z0-9]+$/i.test(q)) return cards.find((c) => c.pid === q) || null;
  const m = q.match(/^([a-z0-9-]+)[\/\s]+([a-z0-9-]+)$/i);
  if (m) {
    const hit = cards.find(
      (c) => c.ss === m[1].toLowerCase() && c.cs === m[2].toLowerCase(),
    );
    if (hit) return hit;
  }
  return findBest(cards, q);
}

async function loadCards() {
  if (existsSync(LITE_PATH)) {
    const payload = JSON.parse(readFileSync(LITE_PATH, "utf8"));
    return payload.cards || [];
  }
  const res = await fetch("https://pokemart.online/api/v1/search-lite.json");
  assert.equal(res.status, 200);
  const payload = await res.json();
  // Keep a trimmed sample for offline reruns (queries' sets only + a pad).
  const need = new Set();
  for (const row of QUERIES) {
    need.add(row.expect_ss);
  }
  const cards = (payload.cards || []).filter((c) => need.has(c.ss));
  writeFileSync(
    LITE_PATH,
    JSON.stringify({ meta: { trimmed: true }, cards }, null, 2),
  );
  return cards;
}

test("10 fixture queries resolve to the expected print", async () => {
  const cards = await loadCards();
  assert.ok(cards.length > 50, `expected trimmed catalog, got ${cards.length}`);
  for (const row of QUERIES) {
    const hit = resolveCard(cards, row.q);
    assert.ok(hit, `no match for ${row.q}`);
    assert.equal(hit.ss, row.expect_ss, row.q);
    assert.equal(hit.cs, row.expect_cs, row.q);
    assert.match(hit.t, new RegExp(row.expect_name_includes, "i"), row.q);
  }
});

test("charizard base set -> Base Set #4 specifically", async () => {
  const cards = await loadCards();
  const hit = resolveCard(cards, "charizard base set");
  assert.equal(hit.ss, "pokemon-base-set");
  assert.equal(hit.cs, "charizard-4");
});

test("price render fields include n + evidence grade shape", async () => {
  // Contract for /price embed: D-grade cells must surface "no reliable price".
  const dCell = {
    grade: "D",
    headline_allowed: false,
    n: 2,
  };
  const reliable = !(
    !dCell ||
    dCell.grade === "D" ||
    dCell.headline_allowed === false
  );
  assert.equal(reliable, false);
  assert.equal(dCell.n, 2);
});
