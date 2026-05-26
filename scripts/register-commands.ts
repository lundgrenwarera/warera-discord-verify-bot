import { readFileSync } from "node:fs";

const commands = [
  {
    name: "verify",
    description: "Link your Discord account to your War Era account",
    options: [
      { type: 3, name: "username", description: "Your War Era username", required: true },
    ],
  },
  {
    name: "whois",
    description: "Look up a verified user (moderators only)",
    options: [
      { type: 6, name: "user", description: "Discord user to look up" },
      { type: 3, name: "username", description: "War Era username to look up" },
    ],
  },
  {
    name: "verify-setup",
    description: "Configure this server (admins only)",
    default_member_permissions: "8",
    options: [
      { type: 8, name: "verified_role", description: "Role to assign on successful verification", required: true },
      { type: 3, name: "country", description: "Single War Era country to restrict verification to (e.g. Netherlands)" },
      { type: 3, name: "country_roles", description: "JSON map of country → role ID for multi-country servers (advanced)" },
    ],
  },
  {
    name: "unverify",
    description: "Remove your link, or unlink another member (admins only)",
    options: [
      { type: 6, name: "user", description: "Discord user to unlink (admins only)" },
    ],
  },
];

const envFile = readFileSync(".dev.vars", "utf8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}

const appId = env.DISCORD_APP_ID;
const token = env.DISCORD_BOT_TOKEN;
if (!appId || !token) {
  console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN in .dev.vars");
  process.exit(1);
}

const r = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

if (!r.ok) {
  console.error(`Failed: ${r.status}`, await r.text());
  process.exit(1);
}

const result = await r.json();
console.log(`Registered ${(result as unknown[]).length} commands globally.`);
console.log("Note: global commands can take up to 1 hour to propagate. For instant updates during dev, use guild-scoped registration.");
