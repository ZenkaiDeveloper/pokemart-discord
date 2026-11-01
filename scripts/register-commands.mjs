#!/usr/bin/env node
/**
 * Register global slash commands with Discord.
 *
 * Requires env:
 *   DISCORD_APPLICATION_ID
 *   DISCORD_BOT_TOKEN
 *
 * Usage:
 *   DISCORD_APPLICATION_ID=… DISCORD_BOT_TOKEN=… node scripts/register-commands.mjs
 */
const APP_ID = process.env.DISCORD_APPLICATION_ID;
const TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !TOKEN) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN");
  process.exit(1);
}

const STRING = 3;

const commands = [
  {
    name: "price",
    description: "Sold-backed median + range + evidence grade for a print",
    options: [
      {
        name: "card",
        description: "Card name (autocomplete)",
        type: STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: "grade",
        description: "Ladder cell (e.g. Ungraded, Grade 10)",
        type: STRING,
        required: false,
      },
    ],
  },
  {
    name: "comps",
    description: "Last eligible comps + exclusion count",
    options: [
      {
        name: "card",
        description: "Card name (autocomplete)",
        type: STRING,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "passport",
    description: "Price Passport evidence grade for a print",
    options: [
      {
        name: "card",
        description: "Card name (autocomplete)",
        type: STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: "grade",
        description: "Ladder cell (optional)",
        type: STRING,
        required: false,
      },
    ],
  },
  {
    name: "pulse",
    description: "Current Weekly Market Pulse summary",
  },
  {
    name: "about",
    description: "Methodology + links",
  },
];

const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;
const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});
const text = await res.text();
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
console.log("Registered", commands.length, "commands");
console.log(text.slice(0, 500));
