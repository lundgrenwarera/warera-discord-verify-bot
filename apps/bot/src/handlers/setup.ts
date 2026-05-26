import type {
  APIApplicationCommandInteraction,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
} from "discord-api-types/v10";
import type { Env, GovernmentBucket, GuildConfig } from "../types";
import { GOVERNMENT_BUCKETS } from "../types";
import {
  addAllowedCountry, addCountryRole, addForeignCountryRole, addGovernmentRole,
  normalizeConfig, removeAllowedCountry, removeCountryRole, removeForeignCountryRole,
  removeGovernmentRole, renderConfig, setAllowForeignGovernment, setMinLevel,
} from "../lib/config";
import { isAdmin } from "../lib/permissions";
import { messages } from "../lib/messages";
import { editOriginalResponse, sendChannelMessage } from "../lib/discord";
import { getCountryNames } from "../lib/warera-api";
import { renderPanel, type PanelKind } from "../lib/panel";
import { modal, row, textInput } from "../lib/components";
import { getGuildRoleMap } from "../lib/role-cache";

type Edit = (payload: Record<string, unknown>) => Promise<void>;

interface Ctx {
  env: Env;
  interactionToken: string;
  guildId: string;
  channelId?: string;
  callerPermissions: bigint;
}

const KEY = (guildId: string) => `g:${guildId}`;

async function load(env: Env, guildId: string): Promise<GuildConfig> {
  return normalizeConfig(await env.GUILDS.get(KEY(guildId), "json"));
}

async function save(env: Env, guildId: string, cfg: GuildConfig): Promise<void> {
  await env.GUILDS.put(KEY(guildId), JSON.stringify(cfg));
}

function makeEdit(env: Env, token: string): Edit {
  return (payload) => editOriginalResponse({
    appId: env.DISCORD_APP_ID,
    interactionToken: token,
    content: typeof payload.content === "string" ? payload.content : undefined,
    embeds: (payload.embeds as unknown[] | undefined) ?? [],
    components: (payload.components as unknown[] | undefined) ?? [],
  });
}

async function renderTo(ctx: Ctx, kind: PanelKind): Promise<void> {
  const cfg = await load(ctx.env, ctx.guildId);
  const roleNames = await getGuildRoleMap(ctx.env, ctx.guildId);
  const payload = renderPanel(kind, { cfg, roleNames });
  await makeEdit(ctx.env, ctx.interactionToken)({
    embeds: payload.embeds,
    components: payload.components,
  });
}

async function showAck(ctx: Ctx, text: string): Promise<void> {
  await makeEdit(ctx.env, ctx.interactionToken)({ content: text, embeds: [], components: [] });
}

export async function runVerifySetup(
  interaction: APIApplicationCommandInteraction,
  env: Env,
): Promise<void> {
  const guildId = interaction.guild_id!;
  const permissions = BigInt(interaction.member?.permissions ?? "0");
  if (!isAdmin(permissions)) {
    await editOriginalResponse({
      appId: env.DISCORD_APP_ID,
      interactionToken: interaction.token,
      content: messages.adminOnly(),
    });
    return;
  }
  const ctx: Ctx = {
    env,
    interactionToken: interaction.token,
    guildId,
    channelId: interaction.channel_id ?? interaction.channel?.id,
    callerPermissions: permissions,
  };
  await renderTo(ctx, { kind: "main" });
}

interface ComponentData {
  custom_id: string;
  component_type?: number;
  values?: string[];
  resolved?: { roles?: Record<string, unknown> };
}

export async function handleSetupComponent(
  interaction: APIMessageComponentInteraction,
  env: Env,
): Promise<{ openModal?: unknown } | void> {
  const permissions = BigInt(interaction.member?.permissions ?? "0");
  if (!isAdmin(permissions)) {
    await editOriginalResponse({
      appId: env.DISCORD_APP_ID,
      interactionToken: interaction.token,
      content: messages.adminOnly(),
    });
    return;
  }

  const ctx: Ctx = {
    env,
    interactionToken: interaction.token,
    guildId: interaction.guild_id!,
    channelId: interaction.channel_id ?? interaction.channel?.id,
    callerPermissions: permissions,
  };

  const data = interaction.data as unknown as ComponentData;
  const id = data.custom_id;
  const values = data.values ?? [];

  if (id === "setup:back") return renderTo(ctx, { kind: "main" });

  if (id === "setup:verified-role") {
    const roleId = values[0];
    if (!roleId) return renderTo(ctx, { kind: "main" });
    const cfg = await load(env, ctx.guildId);
    await save(env, ctx.guildId, { ...cfg, verifiedRoleId: roleId });
    return renderTo(ctx, { kind: "main" });
  }

  if (id === "setup:countries") return renderTo(ctx, { kind: "countries" });
  if (id === "setup:country-roles") return renderTo(ctx, { kind: "country-roles" });
  if (id === "setup:gov-roles") return renderTo(ctx, { kind: "gov-roles" });
  if (id === "setup:foreign-gov") return renderTo(ctx, { kind: "foreign-gov" });

  if (id === "setup:show-config") {
    const cfg = await load(env, ctx.guildId);
    await makeEdit(env, ctx.interactionToken)({
      content: renderConfig(cfg),
      embeds: [],
      components: [],
    });
    return;
  }

  if (id === "setup:reset") {
    await env.GUILDS.delete(KEY(ctx.guildId));
    return renderTo(ctx, { kind: "main" });
  }

  if (id === "setup:min-level") {
    const cfg = await load(env, ctx.guildId);
    return { openModal: minLevelModal(cfg.minLevel) };
  }

  if (id === "setup:post-welcome") return postWelcome(ctx);

  if (id === "setup:country:add") {
    return { openModal: addCountryModal() };
  }

  if (id === "setup:country:remove-pick") {
    const cfg = await load(env, ctx.guildId);
    const allowed = cfg.allowedCountries ?? [];
    if (allowed.length === 0) return renderTo(ctx, { kind: "country-roles" });
    return { openModal: removeCountryModal(allowed) };
  }

  if (id === "setup:country-role:pick") {
    const country = values[0];
    return renderTo(ctx, { kind: "country-roles", country });
  }

  if (id === "setup:country-role:add-country") {
    return { openModal: pickCountryModal("setup_modal:country-role-country") };
  }

  if (id.startsWith("setup:country-role:add:")) {
    const country = id.slice("setup:country-role:add:".length);
    const roleId = values[0];
    if (roleId) {
      const cfg = await load(env, ctx.guildId);
      await save(env, ctx.guildId, addCountryRole(cfg, country, roleId));
    }
    return renderTo(ctx, { kind: "country-roles", country });
  }

  if (id.startsWith("setup:country-role:remove:")) {
    const country = id.slice("setup:country-role:remove:".length);
    const roleId = values[0];
    if (roleId) {
      const cfg = await load(env, ctx.guildId);
      await save(env, ctx.guildId, removeCountryRole(cfg, country, roleId));
    }
    return renderTo(ctx, { kind: "country-roles", country });
  }

  if (id === "setup:gov-role:pick") {
    const bucket = values[0] as GovernmentBucket;
    if (!GOVERNMENT_BUCKETS.includes(bucket)) return renderTo(ctx, { kind: "gov-roles" });
    return renderTo(ctx, { kind: "gov-roles", bucket });
  }

  if (id.startsWith("setup:gov-role:add:")) {
    const bucket = id.slice("setup:gov-role:add:".length) as GovernmentBucket;
    const roleId = values[0];
    if (roleId && GOVERNMENT_BUCKETS.includes(bucket)) {
      const cfg = await load(env, ctx.guildId);
      await save(env, ctx.guildId, addGovernmentRole(cfg, bucket, roleId));
    }
    return renderTo(ctx, { kind: "gov-roles", bucket });
  }

  if (id.startsWith("setup:gov-role:remove:")) {
    const bucket = id.slice("setup:gov-role:remove:".length) as GovernmentBucket;
    const roleId = values[0];
    if (roleId && GOVERNMENT_BUCKETS.includes(bucket)) {
      const cfg = await load(env, ctx.guildId);
      await save(env, ctx.guildId, removeGovernmentRole(cfg, bucket, roleId));
    }
    return renderTo(ctx, { kind: "gov-roles", bucket });
  }

  if (id === "setup:foreign-gov:toggle") {
    const cfg = await load(env, ctx.guildId);
    await save(env, ctx.guildId, setAllowForeignGovernment(cfg, !cfg.allowForeignGovernment));
    return renderTo(ctx, { kind: "foreign-gov" });
  }

  if (id === "setup:foreign-gov:add-country") {
    return { openModal: pickCountryModal("setup_modal:foreign-gov-country") };
  }

  if (id === "setup:foreign-gov:pick") {
    const country = values[0];
    return renderTo(ctx, { kind: "foreign-gov", country });
  }

  if (id.startsWith("setup:foreign-gov:add-role:")) {
    const country = id.slice("setup:foreign-gov:add-role:".length);
    const roleId = values[0];
    if (roleId) {
      const cfg = await load(env, ctx.guildId);
      await save(env, ctx.guildId, addForeignCountryRole(cfg, country, roleId));
    }
    return renderTo(ctx, { kind: "foreign-gov", country });
  }

  if (id.startsWith("setup:foreign-gov:remove-role:")) {
    const country = id.slice("setup:foreign-gov:remove-role:".length);
    const roleId = values[0];
    if (roleId) {
      const cfg = await load(env, ctx.guildId);
      await save(env, ctx.guildId, removeForeignCountryRole(cfg, country, roleId));
    }
    return renderTo(ctx, { kind: "foreign-gov", country });
  }

  return renderTo(ctx, { kind: "main" });
}

export async function handleSetupModal(
  interaction: APIModalSubmitInteraction,
  env: Env,
): Promise<void> {
  const permissions = BigInt(interaction.member?.permissions ?? "0");
  if (!isAdmin(permissions)) {
    await editOriginalResponse({
      appId: env.DISCORD_APP_ID,
      interactionToken: interaction.token,
      content: messages.adminOnly(),
    });
    return;
  }

  const ctx: Ctx = {
    env,
    interactionToken: interaction.token,
    guildId: interaction.guild_id!,
    channelId: interaction.channel_id ?? interaction.channel?.id,
    callerPermissions: permissions,
  };
  const customId = (interaction.data as unknown as { custom_id: string }).custom_id;
  const value = extractModalValue(interaction, "country").trim();

  if (customId === "setup_modal:country-add") {
    const country = await resolveCountryName(env, value);
    if (!country) return showAck(ctx, `Unknown country: **${value}**. Try again with the exact name.`);
    const cfg = await load(env, ctx.guildId);
    await save(env, ctx.guildId, addAllowedCountry(cfg, country));
    return renderTo(ctx, { kind: "countries" });
  }

  if (customId === "setup_modal:country-remove") {
    const cfg = await load(env, ctx.guildId);
    const allowed = cfg.allowedCountries ?? [];
    const match = allowed.find((c) => c.toLowerCase() === value.toLowerCase());
    if (!match) return showAck(ctx, `**${value}** isn't in the allow-list.`);
    await save(env, ctx.guildId, removeAllowedCountry(cfg, match));
    return renderTo(ctx, { kind: "countries" });
  }

  if (customId === "setup_modal:country-role-country") {
    const country = await resolveCountryName(env, value);
    if (!country) return showAck(ctx, `Unknown country: **${value}**.`);
    return renderTo(ctx, { kind: "country-roles", country });
  }

  if (customId === "setup_modal:foreign-gov-country") {
    const country = await resolveCountryName(env, value);
    if (!country) return showAck(ctx, `Unknown country: **${value}**.`);
    return renderTo(ctx, { kind: "foreign-gov", country });
  }

  if (customId === "setup_modal:min-level") {
    const raw = extractModalValue(interaction, "level").trim();
    const cfg = await load(env, ctx.guildId);
    if (raw === "" || raw === "0") {
      await save(env, ctx.guildId, setMinLevel(cfg, undefined));
      return renderTo(ctx, { kind: "main" });
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      return showAck(ctx, `**${raw}** isn't a valid level. Use a number between 1 and 200, or leave blank to remove the gate.`);
    }
    await save(env, ctx.guildId, setMinLevel(cfg, n));
    return renderTo(ctx, { kind: "main" });
  }
}

async function resolveCountryName(env: Env, input: string): Promise<string | null> {
  if (!input) return null;
  const all = await getCountryNames(env.LINKS);
  const match = all.find((c) => c.toLowerCase() === input.toLowerCase());
  return match ?? null;
}

function addCountryModal() {
  return modal({
    custom_id: "setup_modal:country-add",
    title: "Allow a country",
    inputs: [textInput({
      custom_id: "country",
      label: "Country name (exact War Era name)",
      placeholder: "e.g. Sweden",
      max_length: 64,
    })],
  });
}

function removeCountryModal(allowed: string[]) {
  return modal({
    custom_id: "setup_modal:country-remove",
    title: "Disallow a country",
    inputs: [textInput({
      custom_id: "country",
      label: `Type one of: ${allowed.join(", ").slice(0, 80)}`,
      max_length: 64,
    })],
  });
}

function pickCountryModal(customId: string) {
  return modal({
    custom_id: customId,
    title: "Pick a country",
    inputs: [textInput({
      custom_id: "country",
      label: "Country name (exact War Era name)",
      placeholder: "e.g. Portugal",
      max_length: 64,
    })],
  });
}

function minLevelModal(current: number | undefined) {
  return modal({
    custom_id: "setup_modal:min-level",
    title: "Minimum level for country roles",
    inputs: [textInput({
      custom_id: "level",
      label: "Minimum level (blank or 0 to disable)",
      placeholder: "e.g. 10",
      max_length: 3,
      required: false,
      value: current ? String(current) : undefined,
    })],
  });
}

function extractModalValue(interaction: APIModalSubmitInteraction, name: string): string {
  const components = (interaction.data as unknown as { components?: Array<{ components?: Array<{ custom_id?: string; value?: string }> }> }).components ?? [];
  for (const r of components) {
    for (const c of r.components ?? []) {
      if (c.custom_id === name) return String(c.value ?? "");
    }
  }
  return "";
}

async function postWelcome(ctx: Ctx): Promise<void> {
  const cfg = await load(ctx.env, ctx.guildId);
  if (!cfg.verifiedRoleId) {
    return showAck(ctx, "Set the verified role first.");
  }
  if (!ctx.channelId) {
    return showAck(ctx, "Couldn't determine which channel to post in.");
  }
  const allowed = cfg.allowedCountries ?? [];
  const description = allowed.length > 0 ? `For citizens of: **${allowed.join(", ")}**.` : "";
  const payload = {
    embeds: [{
      title: "Verify your War Era account",
      description,
      color: 0xc8821e,
    }],
    components: [row({ type: 2, style: 1, label: "Verify", custom_id: "verify:start" })],
  };
  const res = await sendChannelMessage({
    botToken: ctx.env.DISCORD_BOT_TOKEN,
    channelId: ctx.channelId,
    payload,
  });
  if (!res.ok) {
    return showAck(ctx, `Couldn't post the welcome message (Discord ${res.status}). Make sure the bot can **View Channel** and **Send Messages** in this channel.`);
  }
  return showAck(ctx, "Welcome message posted in this channel.");
}

export const SETUP_MODAL_PREFIX = "setup_modal:";
export const SETUP_COMPONENT_PREFIX = "setup:";

export async function preflightSetupModal(
  customId: string,
  env: Env,
  guildId: string,
): Promise<unknown | null> {
  if (customId === "setup:country:add") return addCountryModal();
  if (customId === "setup:country:remove-pick") {
    const cfg = await load(env, guildId);
    const allowed = cfg.allowedCountries ?? [];
    if (allowed.length === 0) return null;
    return removeCountryModal(allowed);
  }
  if (customId === "setup:country-role:add-country") {
    return pickCountryModal("setup_modal:country-role-country");
  }
  if (customId === "setup:foreign-gov:add-country") {
    return pickCountryModal("setup_modal:foreign-gov-country");
  }
  if (customId === "setup:min-level") {
    const cfg = await load(env, guildId);
    return minLevelModal(cfg.minLevel);
  }
  return null;
}
