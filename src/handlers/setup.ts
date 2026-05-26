import type { Env, GuildConfig } from "../types";
import { editOriginalResponse } from "../lib/discord";

const ADMIN_PERMS = 0x8n;

export async function runSetup(args: {
  env: Env;
  interactionToken: string;
  callerPermissions: bigint;
  guildId: string;
  verifiedRoleId: string;
  country?: string;
  countryRolesJson?: string;
}): Promise<void> {
  const editFn = (content: string) =>
    editOriginalResponse({
      appId: args.env.DISCORD_APP_ID,
      interactionToken: args.interactionToken,
      content,
      components: [],
    });

  if ((args.callerPermissions & ADMIN_PERMS) === 0n) {
    await editFn("Only server admins can configure the bot.");
    return;
  }

  const config: GuildConfig = { verifiedRoleId: args.verifiedRoleId };

  if (args.country && args.countryRolesJson) {
    await editFn("Use either `country` (single country) or `country_roles` (JSON map), not both.");
    return;
  }

  if (args.country) {
    config.countryRoles = { [args.country]: args.verifiedRoleId };
  } else if (args.countryRolesJson) {
    try {
      const parsed = JSON.parse(args.countryRolesJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        config.countryRoles = parsed as Record<string, string>;
      } else {
        await editFn("`country_roles` must be a JSON object like `{\"Sweden\":\"123456789012345678\"}`.");
        return;
      }
    } catch {
      await editFn("`country_roles` must be valid JSON (e.g. `{\"Sweden\":\"123456789012345678\"}`).");
      return;
    }
  }

  await args.env.GUILDS.put(`g:${args.guildId}`, JSON.stringify(config));
  const lines = [
    `Saved. Verified role: <@&${args.verifiedRoleId}>.`,
    config.countryRoles
      ? `Restricted to: **${Object.keys(config.countryRoles).join(", ")}**.`
      : "Open to all countries.",
  ];
  await editFn(lines.join("\n"));
}
