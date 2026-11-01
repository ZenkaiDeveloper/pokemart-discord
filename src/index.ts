/**
 * PokeMart Discord bot — Cloudflare Worker (HTTP interactions only).
 * No gateway, no message-content intent, no DMs/alerts/scheduled posts.
 */
import { Env } from "./util";
import { verifyDiscordRequest } from "./verify";
import { autocomplete, loadSearchLite, resolveCard } from "./search";
import { buildPriceEmbed } from "./commands/price";
import { buildCompsEmbed } from "./commands/comps";
import { buildPassportEmbed } from "./commands/passport";
import { buildPulseEmbed } from "./commands/pulse";
import { buildAboutEmbed } from "./commands/about";

const PING = 1;
const APPLICATION_COMMAND = 2;
const APPLICATION_COMMAND_AUTOCOMPLETE = 4;

const PONG = 1;
const CHANNEL_MESSAGE = 4;
const DEFERRED_CHANNEL_MESSAGE = 5;
const AUTOCOMPLETE_RESULT = 8;

type DiscordOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
  focused?: boolean;
  options?: DiscordOption[];
};

type DiscordInteraction = {
  type: number;
  id?: string;
  token?: string;
  data?: {
    name?: string;
    options?: DiscordOption[];
  };
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function optValue(
  options: DiscordOption[] | undefined,
  name: string,
): string | null {
  const hit = (options || []).find((o) => o.name === name);
  if (hit?.value == null) return null;
  return String(hit.value);
}

function focusedOption(
  options: DiscordOption[] | undefined,
): DiscordOption | null {
  return (options || []).find((o) => o.focused) || null;
}

async function handleAutocomplete(
  env: Env,
  interaction: DiscordInteraction,
): Promise<Response> {
  const focused = focusedOption(interaction.data?.options);
  const name = focused?.name || "card";
  const q = focused?.value != null ? String(focused.value) : "";
  if (name !== "card") {
    return jsonResponse({ type: AUTOCOMPLETE_RESULT, data: { choices: [] } });
  }
  const cards = await loadSearchLite(env);
  const picks = autocomplete(cards, q, 25);
  return jsonResponse({
    type: AUTOCOMPLETE_RESULT,
    data: {
      choices: picks.map((c) => ({
        name: c.t.slice(0, 100),
        // value carries set/card for stable resolve (≤100 chars)
        value: `${c.ss}/${c.cs}`.slice(0, 100),
      })),
    },
  });
}

async function handleCommand(
  env: Env,
  interaction: DiscordInteraction,
): Promise<Response> {
  const name = (interaction.data?.name || "").toLowerCase();
  const options = interaction.data?.options || [];

  if (name === "about") {
    return jsonResponse({
      type: CHANNEL_MESSAGE,
      data: buildAboutEmbed(env),
    });
  }

  if (name === "pulse") {
    const payload = await buildPulseEmbed(env);
    return jsonResponse({ type: CHANNEL_MESSAGE, data: payload });
  }

  const cardRaw = optValue(options, "card");
  const grade = optValue(options, "grade");

  if (name === "price" || name === "comps" || name === "passport") {
    if (!cardRaw) {
      return jsonResponse({
        type: CHANNEL_MESSAGE,
        data: { content: "Pick a card (autocomplete).", flags: 64 },
      });
    }
    const card = await resolveCard(env, cardRaw);
    if (!card) {
      return jsonResponse({
        type: CHANNEL_MESSAGE,
        data: {
          content: `No print matched \`${cardRaw.slice(0, 80)}\`. Try autocomplete.`,
          flags: 64,
        },
      });
    }
    let payload: { embeds: unknown[]; content?: string };
    if (name === "price") payload = await buildPriceEmbed(env, card, grade);
    else if (name === "comps") payload = await buildCompsEmbed(env, card);
    else payload = await buildPassportEmbed(env, card, grade);
    return jsonResponse({ type: CHANNEL_MESSAGE, data: payload });
  }

  return jsonResponse({
    type: CHANNEL_MESSAGE,
    data: {
      content: "Unknown command. Try `/price`, `/comps`, `/passport`, `/pulse`, `/about`.",
      flags: 64,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return jsonResponse({
        ok: true,
        service: "pokemart-discord",
        interactions: "POST /",
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const signature = request.headers.get("X-Signature-Ed25519") || "";
    const timestamp = request.headers.get("X-Signature-Timestamp") || "";
    const body = await request.text();

    const publicKey = env.DISCORD_PUBLIC_KEY || "";
    if (!publicKey) {
      return new Response("Server misconfigured", { status: 500 });
    }

    const ok = await verifyDiscordRequest(publicKey, signature, timestamp, body);
    if (!ok) {
      return new Response("invalid request signature", { status: 401 });
    }

    let interaction: DiscordInteraction;
    try {
      interaction = JSON.parse(body) as DiscordInteraction;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    if (interaction.type === PING) {
      return jsonResponse({ type: PONG });
    }

    if (interaction.type === APPLICATION_COMMAND_AUTOCOMPLETE) {
      return handleAutocomplete(env, interaction);
    }

    if (interaction.type === APPLICATION_COMMAND) {
      // Discord 3s budget: we answer inline. Cold cache may approach the limit;
      // Cache API keeps p95 CPU low for warm paths. Defer reserved for future
      // follow-up edits if measured > DEFER_AFTER_MS.
      void DEFERRED_CHANNEL_MESSAGE;
      return handleCommand(env, interaction);
    }

    return new Response("Unsupported interaction", { status: 400 });
  },
};
