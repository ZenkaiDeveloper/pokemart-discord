# pokemart-discord

MIT-licensed **Discord bot** for [PokeMart](https://pokemart.online) — Cloudflare Worker using Discord’s **HTTP interactions** endpoint (no gateway, no message-content intent, no DMs/alerts/scheduled posts).

Canonical open-source home: [`ZenkaiDeveloper/pokemart-discord`](https://github.com/ZenkaiDeveloper/pokemart-discord).  
A copy also lives in the site generator tree at `public_site/worker/pokemart-discord/` so it stays next to the other handwritten Workers (never inside the generated `pokemart` deploy repo).

## Commands

| Command | What it does |
|---------|----------------|
| `/price card:[autocomplete] [grade]` | Median, p25–p75, n, evidence grade, capture note, link |
| `/comps card` | Last 5 ladder-eligible comps + exclusion count |
| `/passport card [grade]` | Price Passport evidence grade |
| `/pulse` | Current Weekly Market Pulse summary |
| `/about` | Methodology + API + source links |

Autocomplete resolves against cached `/api/v1/search-lite.json`. Card payloads come from `/sets/{set}/{card}.json`; comps from `/data/v1/comps/{set}.csv`.

`BOT_SHOW_IMAGES=false` by default — embeds are text-only (no card art attachments).

## Secrets (Andy)

Create a Discord application → Bot. Store secrets in the Worker (never commit):

| Secret | Where |
|--------|--------|
| `DISCORD_PUBLIC_KEY` | Developer Portal → General Information → Public Key |
| `DISCORD_APPLICATION_ID` | Application ID |
| `DISCORD_BOT_TOKEN` | Bot token (needed for `register-commands`; optional at request time) |

```bash
cd public_site/worker/pokemart-discord   # or clone of this repo
npx wrangler login
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_APPLICATION_ID
npx wrangler secret put DISCORD_BOT_TOKEN
DISCORD_APPLICATION_ID=… DISCORD_BOT_TOKEN=… npm run register
npx wrangler deploy
```

Then set **Interactions Endpoint URL** in the Discord Developer Portal to the Worker URL (`https://pokemart-discord.<account>.workers.dev/` or a custom route). Discord sends a `PING`; the Worker replies `PONG` after signature check.

Invite URL (replace `APP_ID`):

```text
https://discord.com/oauth2/authorize?client_id=APP_ID&scope=applications.commands
```

No privileged intents. Do not enable message content.

## Tests

```bash
npm test
```

- Signature vectors: valid accepts, tampered body/sig rejects (Ed25519 / WebCrypto).
- 10 fixture queries (e.g. `charizard base set` → Base Set Charizard #4).

## Do not

- Price alerts, deals, pings, DMs, or scheduled posts
- Privileged intents / message-content
- Store user messages
- Ship card art by default (`BOT_SHOW_IMAGES`)
- Mention private ops tooling in public bot copy

## License

MIT — see `LICENSE`.
