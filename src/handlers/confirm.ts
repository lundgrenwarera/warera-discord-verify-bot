import type { Env, GuildConfig, Link, PendingToken } from "../types";
import { addRoleToMember, editOriginalResponse } from "../lib/discord";
import { consume, LIMITS } from "../lib/rate-limit";
import { fetchCompanies, fetchUserById, getCountryName, WareraApiError } from "../lib/warera-api";

export async function runVerifyConfirm(args: {
  env: Env;
  interactionToken: string;
  discordUserId: string;
  guildId: string;
}): Promise<void> {
  const editFn = (content: string) =>
    editOriginalResponse({
      appId: args.env.DISCORD_APP_ID,
      interactionToken: args.interactionToken,
      content,
      components: [],
    });

  const limit = await consume(args.env.TOKENS, `rl:confirm:${args.discordUserId}`, LIMITS.verifyConfirm);
  if (!limit.ok) {
    await editFn(`Too many confirm attempts. Try /verify again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.`);
    return;
  }

  const pending = await args.env.TOKENS.get(`p:${args.discordUserId}`, "json") as PendingToken | null;
  if (!pending) {
    await editFn("No pending verification found, or it expired. Run `/verify` again.");
    return;
  }

  let companies;
  try {
    companies = await fetchCompanies(pending.wareraUserId);
  } catch (e) {
    await editFn(friendlyApiError(e));
    return;
  }

  const tokenLower = pending.token.toLowerCase();
  const match = companies.find((c) => (c.name ?? "").toLowerCase().includes(tokenLower));
  if (!match) {
    await editFn([
      `No factory named with the token \`${pending.token}\` found on **${pending.wareraUsername}**.`,
      "",
      "Make sure the factory was saved with the token in its name, then click Confirm again.",
    ].join("\n"));
    return;
  }

  let countryId: string | undefined;
  try {
    const user = await fetchUserById(pending.wareraUserId);
    countryId = user.country;
  } catch {
    /* country lookup is best-effort */
  }
  const countryName = await getCountryName(args.env.LINKS, countryId);

  const cfg = await args.env.GUILDS.get(`g:${args.guildId}`, "json") as GuildConfig | null;
  const countryRestrict = cfg?.countryRoles && Object.keys(cfg.countryRoles).length > 0;
  if (countryRestrict) {
    if (!countryName) {
      await editFn("Couldn't read your War Era country, so this country-restricted server can't verify you. Try again in a few minutes.");
      return;
    }
    if (!cfg!.countryRoles![countryName]) {
      const allowed = Object.keys(cfg!.countryRoles!).join(", ");
      await editFn(`This server only verifies citizens of: **${allowed}**. Your War Era account shows country **${countryName}**, which isn't on the list. If that's a mistake, contact a server moderator.`);
      return;
    }
  }

  const link: Link = {
    wareraUserId: pending.wareraUserId,
    wareraUsername: pending.wareraUsername,
    country: countryName ?? undefined,
    verifiedAt: Math.floor(Date.now() / 1000),
  };

  await Promise.all([
    args.env.LINKS.put(`d:${args.discordUserId}`, JSON.stringify(link)),
    args.env.LINKS.put(`w:${pending.wareraUserId}`, args.discordUserId),
    args.env.TOKENS.delete(`p:${args.discordUserId}`),
  ]);

  const roleResults: string[] = [];
  if (cfg?.verifiedRoleId) {
    const res = await addRoleToMember({
      botToken: args.env.DISCORD_BOT_TOKEN,
      guildId: args.guildId,
      userId: args.discordUserId,
      roleId: cfg.verifiedRoleId,
    });
    roleResults.push(res.ok ? "Verified role assigned." : `Couldn't assign verified role (Discord ${res.status}). A mod can fix the role permissions.`);
  }
  if (cfg?.countryRoles && countryName) {
    const roleId = cfg.countryRoles[countryName];
    if (roleId) {
      const res = await addRoleToMember({
        botToken: args.env.DISCORD_BOT_TOKEN,
        guildId: args.guildId,
        userId: args.discordUserId,
        roleId,
      });
      roleResults.push(res.ok ? `${countryName} role assigned.` : `Couldn't assign ${countryName} role (Discord ${res.status}).`);
    }
  }

  const lines = [
    `✓ Verified as **${pending.wareraUsername}** (via factory \`${match.name}\`).`,
    countryName ? `Country on file: **${countryName}**.` : null,
    ...roleResults,
    "",
    "You can rename the factory back to whatever you like now.",
  ].filter(Boolean);
  await editFn(lines.join("\n"));
}

function friendlyApiError(e: unknown): string {
  if (e instanceof WareraApiError) {
    if (e.status === 503 || e.status === 502 || e.status === 504) {
      return "The War Era API is down right now. Try again in a few minutes.";
    }
    if (e.status === 429) {
      return "The War Era API rate-limited us. Wait a minute and try again.";
    }
    return `War Era API error (${e.status}).`;
  }
  return "Couldn't reach the War Era API. Try again in a minute.";
}
