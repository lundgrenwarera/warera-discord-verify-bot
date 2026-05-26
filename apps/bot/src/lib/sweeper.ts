import type { Env } from "../types";

interface BotGuild { id: string }

export interface SweepResult {
  botGuildCount: number;
  configsBefore: number;
  configsRemoved: string[];
  rolesCacheRemoved: string[];
}

export async function sweepOrphanedGuilds(env: Env): Promise<SweepResult> {
  const r = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  if (!r.ok) {
    throw new Error(`could not list bot guilds (${r.status})`);
  }
  const botGuilds = await r.json() as BotGuild[];
  const live = new Set(botGuilds.map((g) => g.id));

  const list = await env.GUILDS.list({ prefix: "g:" });
  const configsRemoved: string[] = [];
  for (const key of list.keys) {
    const id = key.name.slice(2);
    if (!live.has(id)) {
      await env.GUILDS.delete(key.name);
      configsRemoved.push(id);
    }
  }

  const rolesList = await env.GUILDS.list({ prefix: "roles:" });
  const rolesCacheRemoved: string[] = [];
  for (const key of rolesList.keys) {
    const id = key.name.slice("roles:".length);
    if (!live.has(id)) {
      await env.GUILDS.delete(key.name);
      rolesCacheRemoved.push(id);
    }
  }

  return {
    botGuildCount: botGuilds.length,
    configsBefore: list.keys.length,
    configsRemoved,
    rolesCacheRemoved,
  };
}
