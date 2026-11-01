import { Env } from "../util";
import { LiteCard } from "../search";
import { loadCardJson, loadCompsForPrint, cardPageUrl } from "../card";

export async function buildCompsEmbed(
  env: Env,
  card: LiteCard,
): Promise<{ embeds: unknown[] }> {
  const json = await loadCardJson(env, card);
  const url = cardPageUrl(env, card, json);
  const printId = json?.print_id || card.pid;
  const setSlug = json?.set_slug || card.ss;
  const { included, excluded } = await loadCompsForPrint(env, setSlug, printId);
  const last5 = included.slice(0, 5);
  const lines =
    last5.length === 0
      ? ["_No ladder-eligible comps yet._"]
      : last5.map(
          (r, i) =>
            `${i + 1}. **${r.sold_date}** · $${r.price_usd} · ${r.grade_label || "—"}`,
        );

  return {
    embeds: [
      {
        title: `${json?.name || card.t} — comps`,
        url,
        description: lines.join("\n"),
        color: 0x3d5a80,
        fields: [
          {
            name: "Eligible shown",
            value: String(last5.length),
            inline: true,
          },
          {
            name: "Excluded (not used)",
            value: String(excluded.length),
            inline: true,
          },
          {
            name: "Capture note",
            value:
              "Browse ended-auction proxies (last bid before close), not confirmed solds.",
          },
        ],
        footer: { text: "Data: PokeMart (pokemart.online) · research only" },
      },
    ],
  };
}
