import type { Env, GuildConfig, Link, PendingToken } from "../types";
import { addRoleToMember, editOriginalResponse } from "../lib/discord";
import { consume, LIMITS } from "../lib/rate-limit";
import { fetchCompanies, fetchUserById, getCountryName, WareraApiError } from "../lib/warera-api";

const FOOTER = "-# bot by [lundgren](https://app.warera.io/user/6a146313f0de273b8b1c27f6)";

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
      `No company named with the token \`${pending.token}\` found on **${pending.wareraUsername}**.`,
      "",
      "Rename one of your companies to include the token, save, then click Confirm again.",
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
  if (!cfg?.verifiedRoleId) {
    await editFn("This server hasn't finished setup yet. An admin needs to run `/verify-config set-verified-role` first.");
    return;
  }
  const allowed = cfg.allowedCountries ?? [];
  if (allowed.length > 0) {
    if (!countryName) {
      await editFn("Couldn't read your War Era country, so this country-restricted server can't verify you. Try again in a few minutes.");
      return;
    }
    if (!allowed.includes(countryName)) {
      await editFn(`This server only verifies citizens of: **${allowed.join(", ")}**. Your War Era account shows country **${countryName}**, which isn't allowed. If that's a mistake, contact a server moderator.`);
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

  const rolesToAssign: string[] = [];
  if (cfg?.verifiedRoleId) rolesToAssign.push(cfg.verifiedRoleId);
  if (cfg?.countryRoles && countryName) {
    const extras = cfg.countryRoles[countryName];
    if (Array.isArray(extras)) rolesToAssign.push(...extras);
  }

  let anyAssignFailed = false;
  for (const roleId of rolesToAssign) {
    const res = await addRoleToMember({
      botToken: args.env.DISCORD_BOT_TOKEN,
      guildId: args.guildId,
      userId: args.discordUserId,
      roleId,
    });
    if (!res.ok) anyAssignFailed = true;
  }

  const lines = ["✓ Verified."];
  if (anyAssignFailed) {
    lines.push("");
    lines.push("Heads up: the bot couldn't assign one of your roles. Ask a mod to drag the **WarEra** bot role above the verified/country roles in *Server Settings → Roles*.");
  }
  lines.push("");
  lines.push(FOOTER);
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
