import type { Env, Link } from "../types";
import { editOriginalResponse } from "../lib/discord";
import { consume, LIMITS } from "../lib/rate-limit";

const MOD_PERMS = 0x10000000n;

export async function runWhois(args: {
  env: Env;
  interactionToken: string;
  callerDiscordId: string;
  callerPermissions: bigint;
  targetDiscordId?: string;
  targetUsername?: string;
}): Promise<void> {
  const editFn = (content: string) =>
    editOriginalResponse({
      appId: args.env.DISCORD_APP_ID,
      interactionToken: args.interactionToken,
      content,
      components: [],
    });

  if ((args.callerPermissions & MOD_PERMS) === 0n) {
    await editFn("Only moderators can look up linked accounts.");
    return;
  }

  const limit = await consume(args.env.LINKS, `rl:whois:${args.callerDiscordId}`, LIMITS.whois);
  if (!limit.ok) {
    await editFn(`Too many lookups. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.`);
    return;
  }

  if (args.targetDiscordId) {
    const link = await args.env.LINKS.get(`d:${args.targetDiscordId}`, "json") as Link | null;
    if (!link) {
      await editFn(`<@${args.targetDiscordId}> isn't verified.`);
      return;
    }
    await editFn(formatLink(args.targetDiscordId, link));
    return;
  }

  if (args.targetUsername) {
    const all = await args.env.LINKS.list({ prefix: "d:" });
    for (const key of all.keys) {
      const link = await args.env.LINKS.get(key.name, "json") as Link | null;
      if (link?.wareraUsername.toLowerCase() === args.targetUsername.toLowerCase()) {
        const discordId = key.name.slice(2);
        await editFn(formatLink(discordId, link));
        return;
      }
    }
    await editFn(`No verified user with War Era username **${args.targetUsername}**.`);
    return;
  }

  await editFn("Pass either `user` (Discord member) or `username` (War Era username).");
}

function formatLink(discordId: string, link: Link): string {
  const verifiedAt = new Date(link.verifiedAt * 1000).toISOString().slice(0, 16).replace("T", " ");
  const lines = [
    `<@${discordId}> ↔ War Era **${link.wareraUsername}**`,
    link.country ? `Country on file: ${link.country}` : null,
    `Verified: ${verifiedAt} UTC`,
  ].filter(Boolean);
  return lines.join("\n");
}
