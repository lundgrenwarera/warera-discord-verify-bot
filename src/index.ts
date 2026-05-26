import { InteractionResponseType, InteractionType } from "discord-api-types/v10";
import type {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteraction,
  APIApplicationCommandInteractionDataOption,
  APIMessageComponentInteraction,
} from "discord-api-types/v10";
import { verifySignature } from "./lib/discord";
import { consume, LIMITS } from "./lib/rate-limit";
import { runVerifyStart } from "./handlers/verify";
import { runVerifyConfirm } from "./handlers/confirm";
import { runWhois } from "./handlers/whois";
import {
  runConfigShow, runConfigSetVerifiedRole, runConfigAllowCountry,
  runConfigDisallowCountry, runConfigAddCountryRole, runConfigRemoveCountryRole,
  runConfigReset,
} from "./handlers/config";
import { runUnverify } from "./handlers/unverify";
import { getCountryNames } from "./lib/warera-api";
import type { Env } from "./types";

const DEFERRED_EPHEMERAL = JSON.stringify({
  type: InteractionResponseType.DeferredChannelMessageWithSource,
  data: { flags: 64 },
});

const DEFERRED_UPDATE = JSON.stringify({
  type: InteractionResponseType.DeferredMessageUpdate,
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
      return new Response(DEFERRED_UPDATE, { headers: { "content-type": "application/json" } });
    }

    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      return handleAutocomplete(interaction as APIApplicationCommandAutocompleteInteraction, env);
    }

    return new Response("unhandled interaction type", { status: 400 });
  },
};

async function handleAutocomplete(
  interaction: APIApplicationCommandAutocompleteInteraction,
  env: Env,
): Promise<Response> {
  const focused = findFocusedOption(
    (interaction.data as { options?: APIApplicationCommandInteractionDataOption[] }).options ?? [],
  );
  if (!focused || focused.name !== "country") return autocompleteEmpty();

  const query = String(focused.value ?? "").toLowerCase();
  let names: string[];
  try {
    names = await getCountryNames(env.LINKS);
  } catch {
    return autocompleteEmpty();
  }
  const filtered = (query
    ? names.filter((n) => n.toLowerCase().includes(query))
    : names
  ).slice(0, 25);

  return json({
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: { choices: filtered.map((n) => ({ name: n, value: n })) },
  });
}

function findFocusedOption(
  options: APIApplicationCommandInteractionDataOption[],
): { name: string; value?: string } | null {
  for (const o of options) {
    const opt = o as { name: string; value?: string; focused?: boolean; options?: APIApplicationCommandInteractionDataOption[] };
    if (opt.focused) return opt;
    if (opt.options) {
      const inner = findFocusedOption(opt.options);
      if (inner) return inner;
    }
  }
  return null;
}

function autocompleteEmpty(): Response {
  return json({
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: { choices: [] },
  });
}

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

  if (name === "verify-config") {
    await routeVerifyConfig({
      env, interactionToken: interaction.token, options,
      callerPermissions: permissions, guildId,
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

interface SubOption { name: string; value?: string; type?: number }

async function routeVerifyConfig(args: {
  env: Env;
  interactionToken: string;
  callerPermissions: bigint;
  guildId: string;
  options: APIApplicationCommandInteractionDataOption[];
}): Promise<void> {
  const sub = args.options[0] as { name: string; options?: SubOption[] } | undefined;
  if (!sub) {
    await editFallback(args.env, args.interactionToken, "Missing subcommand. Try `/verify-config show`.");
    return;
  }
  const subOpts = sub.options ?? [];
  const subOpt = (n: string) => subOpts.find((o) => o.name === n);

  const common = {
    env: args.env,
    interactionToken: args.interactionToken,
    callerPermissions: args.callerPermissions,
    guildId: args.guildId,
  };

  if (sub.name === "show") {
    await runConfigShow(common);
    return;
  }
  if (sub.name === "set-verified-role") {
    const roleId = String(subOpt("role")?.value ?? "");
    if (!roleId) {
      await editFallback(args.env, args.interactionToken, "Missing `role`.");
      return;
    }
    await runConfigSetVerifiedRole({ ...common, roleId });
    return;
  }
  if (sub.name === "allow-country") {
    const country = String(subOpt("country")?.value ?? "");
    if (!country) {
      await editFallback(args.env, args.interactionToken, "Missing `country`.");
      return;
    }
    await runConfigAllowCountry({ ...common, country });
    return;
  }
  if (sub.name === "disallow-country") {
    const country = String(subOpt("country")?.value ?? "");
    if (!country) {
      await editFallback(args.env, args.interactionToken, "Missing `country`.");
      return;
    }
    await runConfigDisallowCountry({ ...common, country });
    return;
  }
  if (sub.name === "add-country-role") {
    const country = String(subOpt("country")?.value ?? "");
    const roleId = String(subOpt("role")?.value ?? "");
    if (!country || !roleId) {
      await editFallback(args.env, args.interactionToken, "Missing `country` or `role`.");
      return;
    }
    await runConfigAddCountryRole({ ...common, country, roleId });
    return;
  }
  if (sub.name === "remove-country-role") {
    const country = String(subOpt("country")?.value ?? "");
    const roleId = String(subOpt("role")?.value ?? "");
    if (!country || !roleId) {
      await editFallback(args.env, args.interactionToken, "Missing `country` or `role`.");
      return;
    }
    await runConfigRemoveCountryRole({ ...common, country, roleId });
    return;
  }
  if (sub.name === "reset") {
    await runConfigReset(common);
    return;
  }
  await editFallback(args.env, args.interactionToken, `Unknown subcommand: ${sub.name}`);
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
