import { InteractionResponseType, InteractionType } from "discord-api-types/v10";
import type {
  APIApplicationCommandInteraction,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
} from "discord-api-types/v10";
import { buildApi } from "./api";
import { handleWebhookEvent } from "./handlers/install-event";
import { verifySignature } from "./lib/discord";
import { consume, LIMITS } from "./lib/rate-limit";
import { runVerifyStart } from "./handlers/verify";
import { runVerifyConfirm } from "./handlers/confirm";
import { runWhois } from "./handlers/whois";
import { runUnverify } from "./handlers/unverify";
import { runManualVerify } from "./handlers/manual-verify";
import {
  handleSetupComponent, handleSetupModal,
  preflightSetupModal, runVerifySetup,
} from "./handlers/setup";
import { parsePermissions } from "./lib/permissions";
import type { Env } from "./types";

const DEFERRED_EPHEMERAL = JSON.stringify({
  type: InteractionResponseType.DeferredChannelMessageWithSource,
  data: { flags: 64 },
});

const DEFERRED_UPDATE = JSON.stringify({
  type: InteractionResponseType.DeferredMessageUpdate,
});

const api = buildApi();

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      return api.fetch(req, env, ctx);
    }
    if (req.method !== "POST") return new Response("WarEra Discord Verify Bot", { status: 200 });

    const body = await req.text();
    const sig = req.headers.get("x-signature-ed25519");
    const ts = req.headers.get("x-signature-timestamp");
    const ok = await verifySignature(env.DISCORD_PUBLIC_KEY, body, sig, ts);
    if (!ok) return new Response("bad signature", { status: 401 });

    if (url.pathname === "/discord/events") {
      const payload = JSON.parse(body);
      if (payload.type === 0) return new Response(null, { status: 204 });
      if (payload.type === 1) {
        ctx.waitUntil(handleWebhookEvent(env, payload).catch((e) => console.error("webhook event failed:", e)));
        return new Response(null, { status: 204 });
      }
      return new Response("unhandled webhook type", { status: 400 });
    }

    const interaction = JSON.parse(body);

    if (interaction.type === InteractionType.Ping) {
      return json({ type: InteractionResponseType.Pong });
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      ctx.waitUntil(safeHandle(env, (interaction as APIApplicationCommandInteraction).token, () =>
        handleCommand(interaction as APIApplicationCommandInteraction, env),
      ));
      return new Response(DEFERRED_EPHEMERAL, { headers: { "content-type": "application/json" } });
    }

    if (interaction.type === InteractionType.MessageComponent) {
      const mc = interaction as APIMessageComponentInteraction;
      const customId = (mc.data as { custom_id?: string }).custom_id ?? "";

      if (customId === "verify:start") {
        return json(verifyModalResponse());
      }

      if (customId.startsWith("setup:")) {
        const modal = await preflightSetupModal(customId, env, mc.guild_id!);
        if (modal) {
          return json({ type: InteractionResponseType.Modal, data: modal });
        }
        ctx.waitUntil(safeHandle(env, mc.token, () => handleSetupComponent(mc, env).then(() => undefined)));
        return new Response(DEFERRED_UPDATE, { headers: { "content-type": "application/json" } });
      }

      ctx.waitUntil(safeHandle(env, mc.token, () => handleComponent(mc, env)));
      return new Response(DEFERRED_UPDATE, { headers: { "content-type": "application/json" } });
    }

    if (interaction.type === InteractionType.ModalSubmit) {
      const ms = interaction as APIModalSubmitInteraction;
      const customId = (ms.data as { custom_id?: string }).custom_id ?? "";
      ctx.waitUntil(safeHandle(env, ms.token, () => {
        if (customId.startsWith("setup_modal:")) return handleSetupModal(ms, env);
        return handleModalSubmit(ms, env);
      }));
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
  const options = (interaction.data as { options?: Array<{ name: string; value?: string }> }).options ?? [];
  const opt = (n: string) => options.find((o) => o.name === n);
  const permissions = parsePermissions(interaction.member?.permissions);

  if (name === "verify-setup") {
    await runVerifySetup(interaction, env);
    return;
  }

  if (name === "whois") {
    const targetDiscordId = opt("user")?.value;
    const targetUsername = opt("username")?.value;
    await runWhois({
      env, interactionToken: interaction.token,
      callerDiscordId: discordUserId, callerPermissions: permissions,
      targetDiscordId, targetUsername,
    });
    return;
  }

  if (name === "unverify") {
    const targetDiscordId = opt("user")?.value;
    await runUnverify({
      env, interactionToken: interaction.token,
      callerDiscordId: discordUserId, callerPermissions: permissions,
      targetDiscordId,
    });
    return;
  }

  if (name === "manual-verify") {
    const targetDiscordId = String(opt("user")?.value ?? "");
    const wareraUsername = String(opt("username")?.value ?? "");
    if (!targetDiscordId || !wareraUsername) {
      await editFallback(env, interaction.token, "Missing `user` or `username`.");
      return;
    }
    await runManualVerify({
      env, interactionToken: interaction.token,
      callerDiscordId: discordUserId, callerPermissions: permissions,
      guildId, targetDiscordId, wareraUsername,
    });
    return;
  }

  await editFallback(env, interaction.token, `Unknown command: ${name}`);
}

function verifyModalResponse() {
  return {
    type: InteractionResponseType.Modal,
    data: {
      custom_id: "verify_modal",
      title: "Verify your War Era account",
      components: [{
        type: 1,
        components: [{
          type: 4,
          custom_id: "username",
          label: "War Era username",
          style: 1,
          min_length: 2,
          max_length: 32,
          required: true,
          placeholder: "your in-game username",
        }],
      }],
    },
  };
}

async function handleModalSubmit(interaction: APIModalSubmitInteraction, env: Env): Promise<void> {
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  const guildId = interaction.guild_id;
  if (!discordUserId || !guildId) return;

  const customId = (interaction.data as { custom_id?: string }).custom_id ?? "";
  if (customId !== "verify_modal") {
    await editFallback(env, interaction.token, "Unknown modal.");
    return;
  }

  const rows = (interaction.data as {
    components?: Array<{ components?: Array<{ custom_id?: string; value?: string }> }>;
  }).components ?? [];
  let username = "";
  for (const row of rows) {
    for (const c of row.components ?? []) {
      if (c.custom_id === "username") username = String(c.value ?? "");
    }
  }
  if (!username.trim()) {
    await editFallback(env, interaction.token, "Username is required.");
    return;
  }

  await runVerifyStart({
    env, interactionToken: interaction.token,
    discordUserId, guildId, username: username.trim(),
  });
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
  const r = await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, components: [], allowed_mentions: { parse: [] } }),
  });
  if (!r.ok) {
    console.error(`editFallback failed: ${r.status} ${await r.text()}`);
  }
}

async function safeHandle(env: Env, token: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error("handler threw:", e);
    try {
      await editFallback(env, token, "Something went wrong. Please try again, and ping a mod if it keeps happening.");
    } catch (inner) {
      console.error("editFallback also threw:", inner);
    }
  }
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
