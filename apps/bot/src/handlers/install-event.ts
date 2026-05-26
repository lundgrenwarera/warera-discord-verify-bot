import type { Env } from "../types";

const API = "https://discord.com/api/v10";

interface ApplicationAuthorizedEvent {
  type: 0;
  event: {
    type: "APPLICATION_AUTHORIZED";
    data: {
      integration_type?: 0 | 1;
      user: { id: string; username: string };
      scopes: string[];
      guild?: { id: string; name: string };
    };
  };
}

export async function handleWebhookEvent(env: Env, body: ApplicationAuthorizedEvent): Promise<void> {
  if (body.event?.type !== "APPLICATION_AUTHORIZED") return;
  const data = body.event.data;
  if (!data.guild) return;
  await sendInstallerDM(env, data.user.id, data.guild.name);
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
