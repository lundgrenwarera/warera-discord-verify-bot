import { existsSync, readFileSync } from "node:fs";

const commands = [
  {
    name: "verify-setup",
    description: "Open the verification setup panel (admins only)",
    default_member_permissions: "8",
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
    name: "unverify",
    description: "Remove your link, or unlink another member (admins only)",
    options: [
      { type: 6, name: "user", description: "Discord user to unlink (admins only)" },
    ],
  },
];

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
  console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN. Set via env vars or .dev.vars.");
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
