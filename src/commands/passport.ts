import { Env } from "../util";
import { LiteCard } from "../search";
import {
  loadCardJson,
  pickCell,
  evidenceGrade,
  isReliable,
  cardPageUrl,
} from "../card";

export async function buildPassportEmbed(
  env: Env,
  card: LiteCard,
  grade?: string | null,
): Promise<{ embeds: unknown[] }> {
  const json = await loadCardJson(env, card);
  const url = cardPageUrl(env, card, json);
  if (!json) {
    return {
      embeds: [
        {
          title: card.t,
          url,
          description: "Passport JSON not available yet.",
          color: 0x2b2d31,
        },
      ],
    };
  }
  const { label, passport } = pickCell(json, grade);
  const best = json.passport?.best;
  const g = evidenceGrade(passport);
  const fields = [
    {
      name: "Evidence grade",
      value: g,
      inline: true,
    },
    {
      name: "Headline allowed",
      value: isReliable(passport) ? "yes" : "no",
      inline: true,
    },
    {
      name: "Cell",
      value: label,
      inline: true,
    },
    {
      name: "n (clean)",
      value: String(passport?.n ?? best?.n_clean ?? 0),
      inline: true,
    },
    {
      name: "Newest age (days)",
      value: passport?.newest_age_days != null ? String(passport.newest_age_days) : "—",
      inline: true,
    },
    {
      name: "Window (days)",
      value: passport?.window_days != null ? String(passport.window_days) : "—",
      inline: true,
    },
  ];
  if (passport?.chip) {
    fields.push({ name: "Chip", value: passport.chip, inline: false });
  }
  if (best?.chip && best.grade_label !== label) {
    fields.push({
      name: "Best cell",
      value: `${best.grade_label}: ${best.chip}`,
      inline: false,
    });
  }

  return {
    embeds: [
      {
        title: `${json.name || card.t} — Passport`,
        url,
        description:
          "Price Passport grades how strong the recent clean comps are — not what you will pay.",
        color: isReliable(passport) ? 0x3d8b6e : 0x8a6d3b,
        fields,
        footer: { text: "Data: PokeMart (pokemart.online) · /methodology" },
      },
    ],
  };
}
