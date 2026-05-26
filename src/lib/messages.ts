/**
 * Centralized copy and embed builders so handlers stay free of inline strings.
 */

export const COLOR_PRIMARY = 0xc8821e;

export const CREDIT_AUTHOR = {
  name: "bot by Lundgren",
  url: "https://app.warera.io/user/6a146313f0de273b8b1c27f6",
};

export interface Embed {
  description?: string;
  color?: number;
  author?: { name: string; url?: string };
  footer?: { text: string };
  title?: string;
}

function brandedEmbed(description: string): Embed {
  return { description, color: COLOR_PRIMARY, author: CREDIT_AUTHOR };
}

export const messages = {
  verifiedSuccess: () => brandedEmbed("✓ Verified."),

  roleHierarchyFailure: () => brandedEmbed([
    "Couldn't finish verification: the bot can't assign one of the required roles.",
    "",
    "Ask a mod to drag the **WarEra** bot role above the verified and country roles in *Server Settings → Roles*, then click Confirm again.",
  ].join("\n")),

  somethingWentWrong: () =>
    "Something went wrong. Please try again, and ping a mod if it keeps happening.",

  adminOnly: () => "Only admins can do that.",

  noPendingVerification: () =>
    "No pending verification found, or it expired. Click Verify again.",

  tokenNotFound: (token: string, username: string) => [
    `No company named with the token \`${token}\` found on **${username}**.`,
    "",
    "Rename one of your companies to include the token, save, then click Confirm again.",
  ].join("\n"),

  setupIncomplete: () =>
    "This server hasn't finished setup yet. An admin needs to run `/verify-config set-verified-role` first.",

  countryRequired: () =>
    "Couldn't read your War Era country, so this country-restricted server can't verify you. Try again in a few minutes.",

  countryNotAllowed: (allowed: string[], actual: string) =>
    `This server only verifies citizens of: **${allowed.join(", ")}**. Your War Era account shows country **${actual}**, which isn't allowed. If that's a mistake, contact a server moderator.`,

  rateLimitVerifyStart: (mins: number) =>
    `You've started verification too many times. Try again in ${mins} minutes.`,

  rateLimitConfirm: (mins: number) =>
    `Too many confirm attempts. Click Verify again in ${mins} minutes.`,

  rateLimitGlobal: () => "The bot is rate-limited globally right now. Try again in a minute.",

  apiDown: () => "The War Era API is down right now. Try again in a few minutes.",
  apiRateLimited: () => "The War Era API rate-limited us. Wait a minute and try again.",
  apiError: (status: number) => `War Era API error (${status}).`,
  apiUnreachable: () => "Couldn't reach the War Era API. Try again in a minute.",
};
