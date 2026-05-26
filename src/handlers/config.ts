import type { Env, GuildConfig } from "../types";
import { editOriginalResponse } from "../lib/discord";

const ADMIN_PERMS = 0x8n;

interface CommonArgs {
  env: Env;
  interactionToken: string;
  callerPermissions: bigint;
  guildId: string;
}

function edit(args: CommonArgs, content: string) {
  return editOriginalResponse({
    appId: args.env.DISCORD_APP_ID,
    interactionToken: args.interactionToken,
    content,
    components: [],
  });
}

function isAdmin(perms: bigint): boolean {
  return (perms & ADMIN_PERMS) !== 0n;
}

async function loadConfig(env: Env, guildId: string): Promise<GuildConfig> {
  const raw = await env.GUILDS.get(`g:${guildId}`, "json") as GuildConfig | null;
  return raw ?? {};
}

async function saveConfig(env: Env, guildId: string, cfg: GuildConfig): Promise<void> {
  await env.GUILDS.put(`g:${guildId}`, JSON.stringify(cfg));
}

export async function runConfigShow(args: CommonArgs): Promise<void> {
  if (!isAdmin(args.callerPermissions)) {
    await edit(args, "Only admins can view the config.");
    return;
  }
  const cfg = await loadConfig(args.env, args.guildId);
  await edit(args, renderConfig(cfg));
}

export async function runConfigSetVerifiedRole(args: CommonArgs & { roleId: string }): Promise<void> {
  if (!isAdmin(args.callerPermissions)) {
    await edit(args, "Only admins can change the config.");
    return;
  }
  const cfg = await loadConfig(args.env, args.guildId);
  cfg.verifiedRoleId = args.roleId;
  await saveConfig(args.env, args.guildId, cfg);
  await edit(args, `Verified role set to <@&${args.roleId}>.\n\n${renderConfig(cfg)}`);
}

export async function runConfigAllowCountry(args: CommonArgs & { country: string }): Promise<void> {
  if (!isAdmin(args.callerPermissions)) {
    await edit(args, "Only admins can change the config.");
    return;
  }
  const cfg = await loadConfig(args.env, args.guildId);
  const allowed = new Set(cfg.allowedCountries ?? []);
  allowed.add(args.country);
  cfg.allowedCountries = Array.from(allowed).sort();
  await saveConfig(args.env, args.guildId, cfg);
  await edit(args, `Added **${args.country}** to allowed countries.\n\n${renderConfig(cfg)}`);
}

export async function runConfigDisallowCountry(args: CommonArgs & { country: string }): Promise<void> {
  if (!isAdmin(args.callerPermissions)) {
    await edit(args, "Only admins can change the config.");
    return;
  }
  const cfg = await loadConfig(args.env, args.guildId);
  const allowed = (cfg.allowedCountries ?? []).filter((c) => c !== args.country);
  cfg.allowedCountries = allowed.length > 0 ? allowed : undefined;
  await saveConfig(args.env, args.guildId, cfg);
  await edit(args, `Removed **${args.country}** from allowed countries.\n\n${renderConfig(cfg)}`);
}

export async function runConfigAddCountryRole(args: CommonArgs & { country: string; roleId: string }): Promise<void> {
  if (!isAdmin(args.callerPermissions)) {
    await edit(args, "Only admins can change the config.");
    return;
  }
  const cfg = await loadConfig(args.env, args.guildId);
  const map = cfg.countryRoles ?? {};
  const list = new Set(map[args.country] ?? []);
  list.add(args.roleId);
  map[args.country] = Array.from(list);
  cfg.countryRoles = map;
  await saveConfig(args.env, args.guildId, cfg);
  await edit(args, `Added <@&${args.roleId}> as a role for **${args.country}** verifications.\n\n${renderConfig(cfg)}`);
}

export async function runConfigRemoveCountryRole(args: CommonArgs & { country: string; roleId: string }): Promise<void> {
  if (!isAdmin(args.callerPermissions)) {
    await edit(args, "Only admins can change the config.");
    return;
  }
  const cfg = await loadConfig(args.env, args.guildId);
  const map = cfg.countryRoles ?? {};
  const list = (map[args.country] ?? []).filter((id) => id !== args.roleId);
  if (list.length > 0) map[args.country] = list;
  else delete map[args.country];
  cfg.countryRoles = Object.keys(map).length > 0 ? map : undefined;
  await saveConfig(args.env, args.guildId, cfg);
  await edit(args, `Removed <@&${args.roleId}> from **${args.country}** verifications.\n\n${renderConfig(cfg)}`);
}

export async function runConfigReset(args: CommonArgs): Promise<void> {
  if (!isAdmin(args.callerPermissions)) {
    await edit(args, "Only admins can reset the config.");
    return;
  }
  await args.env.GUILDS.delete(`g:${args.guildId}`);
  await edit(args, "Config wiped. Run `/verify-config set-verified-role` to start again.");
}

function renderConfig(cfg: GuildConfig): string {
  const lines: string[] = ["**Current config**"];
  lines.push(`Verified role: ${cfg.verifiedRoleId ? `<@&${cfg.verifiedRoleId}>` : "_(not set, verification will fail)_"}`);
  const allowed = cfg.allowedCountries ?? [];
  lines.push(`Allowed countries: ${allowed.length > 0 ? allowed.map((c) => `**${c}**`).join(", ") : "_(any country)_"}`);
  const map = cfg.countryRoles ?? {};
  const entries = Object.entries(map);
  if (entries.length === 0) {
    lines.push("Country roles: _(none configured)_");
  } else {
    lines.push("Country roles:");
    for (const [country, roleIds] of entries.sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`· **${country}** → ${roleIds.map((id) => `<@&${id}>`).join(", ")}`);
    }
  }
  return lines.join("\n");
}
