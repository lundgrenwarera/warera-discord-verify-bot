import { InteractionResponseType, InteractionType } from "discord-api-types/v10";
import type {
  APIApplicationCommandInteraction,
  APIApplicationCommandInteractionDataOption,
  APIMessageComponentInteraction,
} from "discord-api-types/v10";
import { verifySignature } from "./lib/discord";
import { consume, LIMITS } from "./lib/rate-limit";
import { runVerifyStart } from "./handlers/verify";
import { runVerifyConfirm } from "./handlers/confirm";
import { runWhois } from "./handlers/whois";
import { runSetup } from "./handlers/setup";
import { runUnverify } from "./handlers/unverify";
import type { Env } from "./types";

const DEFERRED_EPHEMERAL = JSON.stringify({
  type: InteractionResponseType.DeferredChannelMessageWithSource,
  data: { flags: 64 },
});

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method !== "POST") return new Response("WarEra Discord Verify Bot", { status: 200 });

    const body = await req.text();
    const sig = req.headers.get("x-signature-ed25519");
    const ts = req.headers.get("x-signature-timestamp");
    const ok = await verifySignature(env.DISCORD_PUBLIC_KEY, body, sig, ts);
    if (!ok) return new Response("bad signature", { status: 401 });

    const interaction = JSON.parse(body);

    if (interaction.type === InteractionType.Ping) {
      return json({ type: InteractionResponseType.Pong });
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      ctx.waitUntil(handleCommand(interaction as APIApplicationCommandInteraction, env));
      return new Response(DEFERRED_EPHEMERAL, { headers: { "content-type": "application/json" } });
    }

    if (interaction.type === InteractionType.MessageComponent) {
      ctx.waitUntil(handleComponent(interaction as APIMessageComponentInteraction, env));
      return new Response(DEFERRED_EPHEMERAL, { headers: { "content-type": "application/json" } });
    }

    return new Response("unhandled interaction type", { status: 400 });
  },
};

async function handleCommand(interaction: APIApplicationCommandInteraction, env: Env): Promise<void> {
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  const guildId = interaction.guild_id;
  if (!discordUserId || !guildId) return;

  const globalLimit = await consume(env.TOKENS, "rl:global", LIMITS.globalApi);
  if (!globalLimit.ok) {
    await editFallback(env, interaction.token, "The bot is rate-limited globally right now. Try again in a minute.");
    return;
  }

  const name = (interaction.data as { name: string }).name;
  const options = (interaction.data as { options?: APIApplicationCommandInteractionDataOption[] }).options ?? [];
  const opt = (n: string) => options.find((o) => o.name === n);

  const permissions = BigInt(interaction.member?.permissions ?? "0");

  if (name === "verify") {
    const username = String((opt("username") as { value?: string } | undefined)?.value ?? "");
    if (!username) {
      await editFallback(env, interaction.token, "Pass a username, e.g. `/verify username:lundgren`.");
      return;
    }
    await runVerifyStart({ env, interactionToken: interaction.token, discordUserId, guildId, username });
    return;
  }

  if (name === "whois") {
    const targetDiscordId = (opt("user") as { value?: string } | undefined)?.value;
    const targetUsername = (opt("username") as { value?: string } | undefined)?.value;
    await runWhois({
      env, interactionToken: interaction.token,
      callerDiscordId: discordUserId, callerPermissions: permissions,
      targetDiscordId, targetUsername,
    });
    return;
  }

  if (name === "verify-setup") {
    const verifiedRoleId = String((opt("verified_role") as { value?: string } | undefined)?.value ?? "");
    const country = (opt("country") as { value?: string } | undefined)?.value;
    const countryRolesJson = (opt("country_roles") as { value?: string } | undefined)?.value;
    if (!verifiedRoleId) {
      await editFallback(env, interaction.token, "Pass `verified_role`.");
      return;
    }
    await runSetup({
      env, interactionToken: interaction.token,
      callerPermissions: permissions, guildId,
      verifiedRoleId, country, countryRolesJson,
    });
    return;
  }

  if (name === "unverify") {
    const targetDiscordId = (opt("user") as { value?: string } | undefined)?.value;
    await runUnverify({
      env, interactionToken: interaction.token,
      callerDiscordId: discordUserId, callerPermissions: permissions,
      targetDiscordId,
    });
    return;
  }

  await editFallback(env, interaction.token, `Unknown command: ${name}`);
}

async function handleComponent(interaction: APIMessageComponentInteraction, env: Env): Promise<void> {
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  const guildId = interaction.guild_id;
  if (!discordUserId || !guildId) return;

  const customId = (interaction.data as { custom_id: string }).custom_id;
  if (customId === "verify:confirm") {
    await runVerifyConfirm({ env, interactionToken: interaction.token, discordUserId, guildId });
    return;
  }
  if (customId === "verify:cancel") {
    await env.TOKENS.delete(`p:${discordUserId}`);
    await editFallback(env, interaction.token, "Cancelled.");
    return;
  }
}

async function editFallback(env: Env, token: string, content: string): Promise<void> {
  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, components: [] }),
  });
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
