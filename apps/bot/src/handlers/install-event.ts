import type { Env } from "../types";
import { sweepOrphanedGuilds } from "../lib/sweeper";

const API = "https://discord.com/api/v10";

interface WebhookEnvelope {
  type: 0 | 1;
  event?: {
    type: "APPLICATION_AUTHORIZED" | "APPLICATION_DEAUTHORIZED";
    data?: {
      user?: { id: string; username?: string };
      scopes?: string[];
      guild?: { id: string; name: string };
    };
  };
}

export async function handleWebhookEvent(env: Env, body: WebhookEnvelope): Promise<void> {
  const t = body.event?.type;
  if (t === "APPLICATION_AUTHORIZED") {
    const data = body.event?.data;
    if (data?.guild && data.user?.id) {
      await sendInstallerDM(env, data.user.id, data.guild.name);
    }
    return;
  }
  if (t === "APPLICATION_DEAUTHORIZED") {
    const result = await sweepOrphanedGuilds(env);
    console.log(`deauthorize sweep: bot in ${result.botGuildCount} guilds, removed ${result.configsRemoved.length} configs:`, result.configsRemoved);
    return;
  }
}

async function sendInstallerDM(env: Env, userId: string, guildName: string): Promise<void> {
  const dm = await fetch(`${API}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!dm.ok) {
    console.error(`open DM failed: ${dm.status}`);
    return;
  }
  const channel = await dm.json() as { id: string };

  const payload = {
    embeds: [{
      title: `Thanks for adding the verify bot to ${guildName}`,
      description: [
        "Open the dashboard to set the verified role, allowed countries, government roles, and to post the Verify message.",
        "",
        "**[Open the dashboard](https://warera-discord-verify-dashboard.pages.dev/)**",
        "",
        "If this tool helps your server, [a tip goes a long way](https://app.warera.io/article/6a1567a9b59f030545377a9b).",
      ].join("\n"),
      color: 0xc8821e,
      author: {
        name: "bot by Lundgren",
        url: "https://app.warera.io/user/6a146313f0de273b8b1c27f6",
      },
    }],
  };
  const r = await fetch(`${API}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) console.error(`installer DM failed: ${r.status}`);
}
