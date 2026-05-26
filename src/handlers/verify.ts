import type { Env, PendingToken } from "../types";
import { editOriginalResponse } from "../lib/discord";
import { consume, LIMITS } from "../lib/rate-limit";
import { resolveUsername, fetchCompanies, WareraApiError } from "../lib/warera-api";
import { generateToken } from "../lib/token";

export async function runVerifyStart(args: {
  env: Env;
  interactionToken: string;
  discordUserId: string;
  guildId: string;
  username: string;
}): Promise<void> {
  const editFn = (content: string, components: unknown[] = []) =>
    editOriginalResponse({
      appId: args.env.DISCORD_APP_ID,
      interactionToken: args.interactionToken,
      content,
      components,
    });

  const userLimit = await consume(args.env.TOKENS, `rl:verify:${args.discordUserId}`, LIMITS.verifyStart);
  if (!userLimit.ok) {
    await editFn(`You've started verification too many times. Try again in ${Math.ceil(userLimit.retryAfterSec / 60)} minutes.`);
    return;
  }

  const nameLimit = await consume(args.env.TOKENS, `rl:name:${args.username.toLowerCase()}`, LIMITS.wareraLookup);
  if (!nameLimit.ok) {
    await editFn(`This username has been looked up too many times recently. Try again in ${Math.ceil(nameLimit.retryAfterSec / 60)} minutes.`);
    return;
  }

  const existing = await args.env.LINKS.get(`d:${args.discordUserId}`);
  if (existing) {
    await editFn("You're already verified. If you've changed accounts, ask a server moderator to unlink you first.");
    return;
  }

  let user;
  try {
    user = await resolveUsername(args.username);
  } catch (e) {
    await editFn(friendlyApiError(e));
    return;
  }

  if (!user) {
    await editFn(`No War Era user named **${args.username}** found. Check the spelling.`);
    return;
  }

  const claimedKey = `w:${user._id}`;
  const claimedBy = await args.env.LINKS.get(claimedKey);
  if (claimedBy) {
    await editFn("This War Era account is already linked to another Discord user. If you think that's wrong, contact a server moderator.");
    return;
  }

  let companies;
  try {
    companies = await fetchCompanies(user._id);
  } catch (e) {
    await editFn(friendlyApiError(e));
    return;
  }
  if (companies.length === 0) {
    await editFn("You need at least one company to verify. Build one in War Era and try again.");
    return;
  }

  const token = generateToken();
  const pending: PendingToken = {
    token,
    wareraUserId: user._id,
    wareraUsername: user.username,
    discordUserId: args.discordUserId,
    guildId: args.guildId,
    createdAt: Math.floor(Date.now() / 1000),
  };
  const ttl = parseInt(args.env.TOKEN_TTL_SECONDS, 10) || 900;
  await args.env.TOKENS.put(`p:${args.discordUserId}`, JSON.stringify(pending), { expirationTtl: ttl });

  const minutes = Math.floor(ttl / 60);
  const content = [
    `**Verifying ${user.username}.** Within ${minutes} min:`,
    "",
    `1. War Era → Companies → rename any one of your companies to **\`${token}\`**`,
    "2. Click **Confirm** below.",
    "",
    "You can rename the company back after confirming.",
  ].join("\n");

  await editFn(content, [
    {
      type: 1,
      components: [
        { type: 2, style: 3, label: "Confirm", custom_id: "verify:confirm" },
        { type: 2, style: 4, label: "Cancel", custom_id: "verify:cancel" },
      ],
    },
  ]);
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
