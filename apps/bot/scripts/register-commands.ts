import { existsSync, readFileSync } from "node:fs";

const commands: unknown[] = [];

const env: Record<string, string> = { ...process.env } as Record<string, string>;
if (existsSync(".dev.vars")) {
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]*)"?$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}

const appId = env.DISCORD_APP_ID;
const token = env.DISCORD_BOT_TOKEN;
if (!appId || !token) {
  console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN.");
  process.exit(1);
}

const r = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands),
});
if (!r.ok) {
  console.error(`Failed: ${r.status}`, await r.text());
  process.exit(1);
}
console.log("All slash commands deregistered.");
