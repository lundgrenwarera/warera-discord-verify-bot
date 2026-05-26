import type { Env, Link } from "../types";
import { editOriginalResponse } from "../lib/discord";

const ADMIN_PERMS = 0x8n;

export async function runUnverify(args: {
  env: Env;
  interactionToken: string;
  callerDiscordId: string;
  callerPermissions: bigint;
  targetDiscordId?: string;
}): Promise<void> {
  const editFn = (content: string) =>
    editOriginalResponse({
      appId: args.env.DISCORD_APP_ID,
      interactionToken: args.interactionToken,
      content,
      components: [],
    });

  const isAdmin = (args.callerPermissions & ADMIN_PERMS) !== 0n;
  const target = args.targetDiscordId ?? args.callerDiscordId;

  if (target !== args.callerDiscordId && !isAdmin) {
    await editFn("Only admins can unverify other members.");
    return;
  }

  const link = await args.env.LINKS.get(`d:${target}`, "json") as Link | null;
  if (!link) {
    await editFn(target === args.callerDiscordId
      ? "You weren't verified."
      : `<@${target}> wasn't verified.`);
    return;
  }

  await Promise.all([
    args.env.LINKS.delete(`d:${target}`),
    args.env.LINKS.delete(`w:${link.wareraUserId}`),
  ]);

  await editFn(target === args.callerDiscordId
    ? `Removed your verification (was linked to **${link.wareraUsername}**).`
    : `Removed verification for <@${target}> (was linked to **${link.wareraUsername}**).`);
}
