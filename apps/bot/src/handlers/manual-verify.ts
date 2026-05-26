import type { Env, Link } from "../types";
import { addRoleToMember, editOriginalResponse } from "../lib/discord";
import {
  decideVerification, normalizeConfig,
  rolesForCitizen, rolesForForeignGov,
} from "../lib/config";
import { governmentRolesFor, positionsHeldBy } from "../lib/government";
import { fetchGovernment, fetchUserById, getCountryName, resolveUsername } from "../lib/warera-api";
import { friendlyApiError } from "../lib/warera-errors";
import { isAdmin } from "../lib/permissions";
import { messages } from "../lib/messages";

export async function runManualVerify(args: {
  env: Env;
  interactionToken: string;
  callerDiscordId: string;
  callerPermissions: bigint;
  guildId: string;
  targetDiscordId: string;
  wareraUsername: string;
}): Promise<void> {
  const edit = (content: string) =>
    editOriginalResponse({
      appId: args.env.DISCORD_APP_ID,
      interactionToken: args.interactionToken,
      content,
      components: [],
    });

  if (!isAdmin(args.callerPermissions)) {
    await edit(messages.adminOnly());
    return;
  }

  let user;
  try {
    user = await resolveUsername(args.wareraUsername);
  } catch (e) {
    await edit(friendlyApiError(e));
    return;
  }
  if (!user) {
    await edit(`No War Era user named **${args.wareraUsername}** found.`);
    return;
  }

  const existing = await args.env.LINKS.get(`d:${args.targetDiscordId}`);
  if (existing) {
    await edit("That Discord user is already linked. Run `/unverify` first if you want to relink them.");
    return;
  }
  const claimedBy = await args.env.LINKS.get(`w:${user._id}`);
  if (claimedBy) {
    await edit(`That War Era account is already linked to <@${claimedBy}>.`);
    return;
  }

  let countryId = user.country;
  let level = user.leveling?.level;
  try {
    const fresh = await fetchUserById(user._id);
    countryId = fresh.country ?? countryId;
    level = fresh.leveling?.level ?? level;
  } catch { /* keep what we have */ }
  const countryName = await getCountryName(args.env.LINKS, countryId);

  const cfg = normalizeConfig(await args.env.GUILDS.get(`g:${args.guildId}`, "json"));
  if (!cfg.verifiedRoleId) {
    await edit(messages.setupIncomplete());
    return;
  }

  let positions: ReturnType<typeof positionsHeldBy> = [];
  const needsGovernment = !!cfg.allowForeignGovernment || Object.keys(cfg.governmentRoles ?? {}).length > 0;
  if (needsGovernment && countryId) {
    const gov = await fetchGovernment(countryId);
    positions = positionsHeldBy(gov, user._id);
  }

  const decision = decideVerification({
    cfg, countryName, isForeignGov: positions.length > 0,
  });
  if (!decision.allowed) {
    await edit(`Can't manually verify: ${decision.reason === "country-required"
      ? "their War Era account has no country."
      : `their country (${countryName ?? "unknown"}) isn't allowed in this server.`}`);
    return;
  }

  const baseRoles = decision.mode === "citizen"
    ? rolesForCitizen(cfg, countryName, level)
    : rolesForForeignGov(cfg, countryName!, level);
  const govRoles = decision.mode === "citizen" ? governmentRolesFor(cfg, positions) : [];
  const allRoles = Array.from(new Set([...baseRoles, ...govRoles]));

  const failed: string[] = [];
  for (const roleId of allRoles) {
    const res = await addRoleToMember({
      botToken: args.env.DISCORD_BOT_TOKEN,
      guildId: args.guildId,
      userId: args.targetDiscordId,
      roleId,
    });
    if (!res.ok) failed.push(roleId);
  }

  if (failed.length === allRoles.length) {
    await edit("Couldn't assign any roles. Check the bot's role hierarchy in *Server Settings → Roles*.");
    return;
  }

  const link: Link = {
    wareraUserId: user._id,
    wareraUsername: user.username,
    country: countryName ?? undefined,
    verifiedAt: Math.floor(Date.now() / 1000),
  };
  await Promise.all([
    args.env.LINKS.put(`d:${args.targetDiscordId}`, JSON.stringify(link)),
    args.env.LINKS.put(`w:${user._id}`, args.targetDiscordId),
  ]);

  const ok = `Manually verified <@${args.targetDiscordId}> as **${user.username}** (${countryName ?? "no country"}). Assigned ${allRoles.length - failed.length}/${allRoles.length} roles.`;
  await edit(failed.length > 0
    ? `${ok}\n\nCouldn't assign ${failed.length} role(s) — check the bot's role hierarchy.`
    : ok);
}
