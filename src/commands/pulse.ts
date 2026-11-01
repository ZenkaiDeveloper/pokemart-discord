import { Env, absUrl, loadJson, usdFromCents } from "../util";

type PulseIndex = {
  weeks?: {
    week_id: string;
    label: string;
    href: string;
    is_current?: boolean;
    movers_n?: number;
    sales_n?: number;
    summary?: string;
  }[];
};

type PulseWeek = {
  week_id?: string;
  label?: string;
  summary?: string;
  sales_n?: number;
  movers?: {
    title?: string;
    set_name?: string;
    pct?: number;
    price_cents?: number;
    href?: string;
  }[];
  notable_sales?: {
    title?: string;
    price_cents?: number;
    href?: string;
  }[];
};

export async function buildPulseEmbed(
  env: Env,
): Promise<{ embeds: unknown[] }> {
  const index = await loadJson<PulseIndex>(env, "/pulse/index.json");
  const current =
    index?.weeks?.find((w) => w.is_current) || index?.weeks?.[0] || null;
  if (!current) {
    return {
      embeds: [
        {
          title: "Weekly Market Pulse",
          url: absUrl(env, "/pulse/"),
          description: "No pulse week published yet.",
          color: 0x2b2d31,
        },
      ],
    };
  }
  const weekPath = current.href?.endsWith("/")
    ? `${current.href}index.json`
    : `${current.href}/index.json`;
  const week = (await loadJson<PulseWeek>(env, weekPath)) || {};
  const movers = (week.movers || []).slice(0, 3);
  const moverLines =
    movers.length === 0
      ? ["_No movers this week._"]
      : movers.map((m) => {
          const pct = m.pct != null ? `+${m.pct}%` : "";
          const px = m.price_cents != null ? usdFromCents(m.price_cents) : "";
          return `• **${m.title}** (${m.set_name || "—"}) ${pct} ${px}`.trim();
        });

  return {
    embeds: [
      {
        title: `Pulse · ${week.label || current.label}`,
        url: absUrl(env, current.href || "/pulse/"),
        description:
          (week.summary || current.summary || "") +
          "\n\n" +
          moverLines.join("\n"),
        color: 0x4a6fa5,
        fields: [
          {
            name: "Sales (mapped)",
            value: String(week.sales_n ?? current.sales_n ?? 0),
            inline: true,
          },
          {
            name: "Week",
            value: week.week_id || current.week_id,
            inline: true,
          },
        ],
        footer: {
          text: "Data: PokeMart (pokemart.online) · directional evidence, not advice",
        },
      },
    ],
  };
}
