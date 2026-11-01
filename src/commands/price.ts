import { Env } from "../util";
import { LiteCard } from "../search";
import {
  loadCardJson,
  pickCell,
  isReliable,
  evidenceGrade,
  captureNoteFor,
  cardPageUrl,
  formatMedian,
  formatRange,
} from "../card";

export async function buildPriceEmbed(
  env: Env,
  card: LiteCard,
  grade?: string | null,
): Promise<{ content?: string; embeds: unknown[] }> {
  const json = await loadCardJson(env, card);
  const url = cardPageUrl(env, card, json);
  if (!json) {
    return {
      embeds: [
        {
          title: card.t,
          url,
          description: "No card JSON yet — open the page for whatever evidence exists.",
          color: 0x2b2d31,
        },
      ],
    };
  }

  const { label, cell, passport } = pickCell(json, grade);
  const gradeLetter = evidenceGrade(passport);
  const n = cell?.n ?? passport?.n ?? 0;
  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (!isReliable(passport)) {
    fields.push({
      name: "Price",
      value: "**No reliable price**",
      inline: true,
    });
    fields.push({
      name: "Evidence",
      value: `Grade **${gradeLetter}** · n=${n}`,
      inline: true,
    });
  } else {
    fields.push({
      name: "Median",
      value: formatMedian(cell),
      inline: true,
    });
    fields.push({
      name: "Range (p25–p75)",
      value: formatRange(cell),
      inline: true,
    });
    fields.push({
      name: "n",
      value: String(n),
      inline: true,
    });
    fields.push({
      name: "Evidence grade",
      value: gradeLetter,
      inline: true,
    });
  }

  fields.push({
    name: "Cell",
    value: label,
    inline: true,
  });
  fields.push({
    name: "Capture note",
    value: captureNoteFor(passport),
  });

  return {
    embeds: [
      {
        title: json.name || card.t,
        url,
        description: `Print \`${json.print_id || card.pid}\``,
        color: isReliable(passport) ? 0x3d8b6e : 0x8a6d3b,
        fields,
        footer: { text: "Data: PokeMart (pokemart.online) · research only" },
      },
    ],
  };
}
