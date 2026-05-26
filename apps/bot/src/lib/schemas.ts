import { z } from "zod";

export const PendingTokenSchema = z.object({
  token: z.string().min(1),
  wareraUserId: z.string().min(1),
  wareraUsername: z.string().min(1),
  discordUserId: z.string().min(1),
  guildId: z.string().min(1),
  createdAt: z.number(),
});

export const LinkSchema = z.object({
  wareraUserId: z.string().min(1),
  wareraUsername: z.string().min(1),
  country: z.string().optional(),
  verifiedAt: z.number(),
});

export const GovernmentSchema = z.object({
  president: z.string().optional(),
  vicePresident: z.string().optional(),
  minOfDefense: z.string().optional(),
  minOfEconomy: z.string().optional(),
  minOfForeignAffairs: z.string().optional(),
  congressMembers: z.array(z.string()).optional(),
}).catchall(z.unknown());
