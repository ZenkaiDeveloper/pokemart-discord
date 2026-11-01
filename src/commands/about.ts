import { Env, absUrl } from "../util";

export function buildAboutEmbed(env: Env): { embeds: unknown[] } {
  return {
    embeds: [
      {
        title: "About PokeMart",
        url: absUrl(env, "/"),
        description:
          "PokeMart is a free Pokémon card reference-pricing guide that shows its work: sold-backed medians, evidence grades (Passport), and a public comp audit trail.",
        color: 0x2f5233,
        fields: [
          {
            name: "Methodology",
            value: `[How we price](${absUrl(env, "/methodology")})`,
            inline: true,
          },
          {
            name: "Open API",
            value: `[Docs](${absUrl(env, "/api/")}) · [Help](${absUrl(env, "/help/open-api/")})`,
            inline: true,
          },
          {
            name: "Discord bot help",
            value: `[/help/discord-bot/](${absUrl(env, "/help/discord-bot/")})`,
            inline: true,
          },
          {
            name: "Source",
            value:
              "[pokemart-discord (MIT)](https://github.com/ZenkaiDeveloper/pokemart-discord)",
          },
          {
            name: "Honesty",
            value:
              "Browse ended-auction last bids are proxies, not confirmed solds. No alerts, DMs, or deal pings from this bot.",
          },
        ],
        footer: { text: "Data: PokeMart (pokemart.online)" },
      },
    ],
  };
}
