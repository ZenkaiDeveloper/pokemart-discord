/** Load card JSON + set comps CSV for Discord command payloads. */
import {
  Env,
  absUrl,
  loadJson,
  loadText,
  usdFromCents,
  CAPTURE_NOTE,
} from "./util";
import { LiteCard } from "./search";

export type PassportCell = {
  grade?: string;
  headline_allowed?: boolean;
  n?: number;
  newest_age_days?: number | null;
  window_days?: number | null;
  iqr_ratio?: number | null;
  p25_cents?: number | null;
  p50_cents?: number | null;
  p75_cents?: number | null;
  chip?: string;
  capture_mix?: Record<string, number>;
};

export type LadderCell = {
  grade_label: string;
  p25?: number | null;
  p50?: number | null;
  p75?: number | null;
  n?: number;
  passport?: PassportCell;
  capture_mix?: Record<string, number>;
};

export type CardJson = {
  print_id?: string;
  name?: string;
  set_slug?: string;
  card_slug?: string;
  url?: string;
  cells?: LadderCell[];
  passport?: {
    best?: {
      passport_grade?: string;
      grade_label?: string;
      chip?: string;
      headline_allowed?: number | boolean;
      n_clean?: number;
    };
    cells?: Record<string, PassportCell>;
  };
};

export type CompRow = {
  print_id: string;
  grade_label: string;
  sold_date: string;
  price_usd: string;
  included: boolean;
  exclude_reason: string;
};

export async function loadCardJson(
  env: Env,
  card: LiteCard,
): Promise<CardJson | null> {
  return loadJson<CardJson>(env, `/sets/${card.ss}/${card.cs}.json`);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export async function loadCompsForPrint(
  env: Env,
  setSlug: string,
  printId: string,
): Promise<{ included: CompRow[]; excluded: CompRow[] }> {
  const text = await loadText(env, `/data/v1/comps/${setSlug}.csv`);
  const included: CompRow[] = [];
  const excluded: CompRow[] = [];
  if (!text) return { included, excluded };
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (lines.length < 2) return { included, excluded };
  const header = parseCsvLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);
  const iPid = idx("print_id");
  const iGrade = idx("grade_label");
  const iDate = idx("sold_date");
  const iPrice = idx("price_usd");
  const iInc = idx("included");
  const iEx = idx("exclude_reason");
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols[iPid] !== printId) continue;
    const row: CompRow = {
      print_id: cols[iPid],
      grade_label: cols[iGrade] || "",
      sold_date: cols[iDate] || "",
      price_usd: cols[iPrice] || "",
      included: String(cols[iInc]).toLowerCase() === "true",
      exclude_reason: cols[iEx] || "",
    };
    if (row.included) included.push(row);
    else excluded.push(row);
  }
  // Newest first
  const byDate = (a: CompRow, b: CompRow) =>
    (b.sold_date || "").localeCompare(a.sold_date || "");
  included.sort(byDate);
  excluded.sort(byDate);
  return { included, excluded };
}

export function pickCell(
  card: CardJson,
  gradeWanted?: string | null,
): { label: string; cell: LadderCell | null; passport: PassportCell | null } {
  const cells = Array.isArray(card.cells) ? card.cells : [];
  const want = (gradeWanted || "").trim();
  let cell: LadderCell | null = null;
  if (want) {
    const w = want.toLowerCase();
    cell =
      cells.find((c) => (c.grade_label || "").toLowerCase() === w) ||
      cells.find((c) =>
        (c.grade_label || "").toLowerCase().includes(w),
      ) ||
      null;
  }
  if (!cell) {
    cell =
      cells.find((c) => c.grade_label === "Ungraded") ||
      cells[0] ||
      null;
  }
  const label = cell?.grade_label || want || "Ungraded";
  const fromCell = cell?.passport || null;
  const fromMap = card.passport?.cells?.[label] || null;
  return { label, cell, passport: fromCell || fromMap };
}

export function evidenceGrade(p: PassportCell | null | undefined): string {
  return (p?.grade || "?").toUpperCase();
}

export function isReliable(p: PassportCell | null | undefined): boolean {
  if (!p) return false;
  const g = evidenceGrade(p);
  if (g === "D" || g === "?" ) return false;
  if (p.headline_allowed === false) return false;
  return true;
}

export function captureNoteFor(p: PassportCell | null | undefined): string {
  const mix = p?.capture_mix || {};
  if (mix.browse_auction_last_seen || Object.keys(mix).length === 0) {
    return CAPTURE_NOTE;
  }
  return CAPTURE_NOTE;
}

export function cardPageUrl(env: Env, card: LiteCard, json?: CardJson | null): string {
  if (json?.url) return absUrl(env, json.url);
  return absUrl(env, `/sets/${card.ss}/${card.cs}`);
}

export function formatRange(cell: LadderCell | null): string {
  if (!cell) return "—";
  return `${usdFromCents(cell.p25 ?? null)} – ${usdFromCents(cell.p75 ?? null)}`;
}

export function formatMedian(cell: LadderCell | null): string {
  return usdFromCents(cell?.p50 ?? null);
}
