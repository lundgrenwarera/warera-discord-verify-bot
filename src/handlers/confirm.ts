import type { Env, Link, PendingToken } from "../types";
import { addRoleToMember, editOriginalResponse } from "../lib/discord";
import { consume, LIMITS } from "../lib/rate-limit";
import {
  fetchCompanies, fetchGovernment, fetchUserById,
  getCountryName,
} from "../lib/warera-api";
import { friendlyApiError } from "../lib/warera-errors";
import {
  decideVerification, normalizeConfig,
  rolesForCitizen, rolesForForeignGov,
} from "../lib/config";
import { governmentRolesFor, positionsHeldBy } from "../lib/government";
import { messages } from "../lib/messages";

export async function runVerifyConfirm(args: {
  env: Env;
  interactionToken: string;
  discordUserId: string;
  guildId: string;
}): Promise<void> {
  const editText = (content: string) =>
    editOriginalResponse({
      appId: args.env.DISCORD_APP_ID,
      interactionToken: args.interactionToken,
      content,
      components: [],
    });
  const editEmbed = (embed: unknown) =>
    editOriginalResponse({
      appId: args.env.DISCORD_APP_ID,
      interactionToken: args.interactionToken,
      components: [],
      embeds: [embed],
    });

  const limit = await consume(args.env.TOKENS, `rl:confirm:${args.discordUserId}`, LIMITS.verifyConfirm);
  if (!limit.ok) {
    await editText(messages.rateLimitConfirm(Math.ceil(limit.retryAfterSec / 60)));
    return;
  }

  const pending = await args.env.TOKENS.get(`p:${args.discordUserId}`, "json") as PendingToken | null;
  if (!pending) {
    await editText(messages.noPendingVerification());
    return;
  }

  let companies;
  try {
    companies = await fetchCompanies(pending.wareraUserId);
  } catch (e) {
    await editText(friendlyApiError(e));
    return;
  }

  const tokenLower = pending.token.toLowerCase();
  const match = companies.find((c) => (c.name ?? "").toLowerCase().includes(tokenLower));
  if (!match) {
    await editText(messages.tokenNotFound(pending.token, pending.wareraUsername));
    return;
  }

  let countryId: string | undefined;
  try {
    const user = await fetchUserById(pending.wareraUserId);
    countryId = user.country;
  } catch { /* best-effort */ }
  const countryName = await getCountryName(args.env.LINKS, countryId);

  const cfg = normalizeConfig(await args.env.GUILDS.get(`g:${args.guildId}`, "json"));
  if (!cfg.verifiedRoleId) {
    await editText(messages.setupIncomplete());
    return;
  }

  const needsGovernment = !!cfg.allowForeignGovernment || Object.keys(cfg.governmentRoles ?? {}).length > 0;
  let positions: ReturnType<typeof positionsHeldBy> = [];
  if (needsGovernment && countryId) {
    const gov = await fetchGovernment(countryId);
    positions = positionsHeldBy(gov, pending.wareraUserId);
  }

  const decision = decideVerification({
    cfg, countryName, isForeignGov: positions.length > 0,
  });
  if (!decision.allowed) {
    if (decision.reason === "country-required") {
      await editText(messages.countryRequired());
    } else {
      await editText(messages.countryNotAllowed(cfg.allowedCountries ?? [], countryName!));
    }
    return;
  }

  const baseRoles = decision.mode === "citizen"
    ? rolesForCitizen(cfg, countryName)
    : rolesForForeignGov(cfg, countryName!);
  const govRoles = decision.mode === "citizen" ? governmentRolesFor(cfg, positions) : [];
  const allRoles = Array.from(new Set([...baseRoles, ...govRoles]));

  for (const roleId of allRoles) {
    const res = await addRoleToMember({
      botToken: args.env.DISCORD_BOT_TOKEN,
      guildId: args.guildId,
      userId: args.discordUserId,
      roleId,
    });
    if (!res.ok) {
      await editEmbed(messages.roleHierarchyFailure());
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

  await editEmbed(messages.verifiedSuccess());
}
