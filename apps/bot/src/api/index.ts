import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { Env, GuildConfig } from "../types";
import { GOVERNMENT_BUCKETS } from "../types";
import {
  cacheUserGuilds, computeManagerGuildIds, exchangeOAuthCode, fetchOAuthGuilds, fetchOAuthUser,
  getCachedUserGuilds, issueSession, pickAdminGuildIds, verifySession, type SessionPayload,
} from "./auth";
import { buildMembersView, GuildAccessError } from "./members";
import { checkHierarchy, collectConfiguredRoleIds } from "../lib/hierarchy";
import { fetchGuildRoles, sendChannelMessage } from "../lib/discord";
import { fetchGovernment, fetchUserById, getCountryName, getCountryNames, resolveUsername } from "../lib/warera-api";

async function fetchUserByIdSafe(id: string) {
  try {
    return await fetchUserById(id);
  } catch {
    return null;
  }
}
import { normalizeConfig, decideVerification, rolesForCitizen, rolesForForeignGov } from "../lib/config";
import { governmentRolesFor, positionsHeldBy } from "../lib/government";
import { isAdmin, parsePermissions } from "../lib/permissions";

type AppEnv = { Bindings: Env; Variables: { session: SessionPayload } };

const ConfigSchema = z.object({
  verifiedRoleId: z.string().min(1).optional(),
  allowedCountries: z.array(z.string().min(1)).optional(),
  countryRoles: z.record(z.string(), z.array(z.string())).optional(),
  governmentRoles: z.record(z.enum(GOVERNMENT_BUCKETS), z.array(z.string())).optional(),
  allowForeignGovernment: z.boolean().optional(),
  foreignCountryRoles: z.record(z.string(), z.array(z.string())).optional(),
  minLevel: z.number().int().min(1).max(200).optional(),
  dashboardManagerRoleIds: z.array(z.string()).optional(),
}).strict();

export function buildApi(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const origin = c.env.DASHBOARD_ORIGIN;
    return cors({
      origin: origin ? [origin, "http://localhost:5174"] : "*",
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      credentials: false,
      maxAge: 86400,
    })(c, next);
  });

  app.post("/api/auth", async (c) => {
    const body = await c.req.json().catch(() => null) as { code?: string; redirectUri?: string } | null;
    if (!body?.code || !body?.redirectUri) return c.json({ error: "missing code/redirectUri" }, 400);

    const token = await exchangeOAuthCode(c.env, body.code, body.redirectUri);
    const [user, guilds] = await Promise.all([
      fetchOAuthUser(token.access_token),
      fetchOAuthGuilds(token.access_token),
    ]);

    const adminIds = pickAdminGuildIds(guilds);
    const adminSet = new Set(adminIds);
    const managerIds = await computeManagerGuildIds(c.env, user.id, adminSet, guilds);

    const payload: SessionPayload = {
      userId: user.id,
      username: user.username,
      avatar: user.avatar ?? undefined,
      adminGuildIds: adminIds,
      managerGuildIds: managerIds,
    };
    await cacheUserGuilds(c.env, user.id, guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon })));
    const sessionToken = await issueSession(c.env, payload);
    return c.json({ token: sessionToken });
  });

  const requireAuth = async (c: any, next: any) => {
    const h = c.req.header("Authorization") ?? "";
    if (!h.startsWith("Bearer ")) return c.json({ error: "missing token" }, 401);
    const session = await verifySession(c.env, h.slice(7));
    if (!session) return c.json({ error: "invalid token" }, 401);
    c.set("session", session);
    return next();
  };

  app.use("/api/me/*", requireAuth);
  app.use("/api/guilds/*", requireAuth);

  app.get("/api/me/guilds", async (c) => {
    const session = c.var.session;
    const allIds = Array.from(new Set([...session.adminGuildIds, ...session.managerGuildIds]));
    const cached = await getCachedUserGuilds(c.env, session.userId);
    const cachedMap = new Map(cached.map((g) => [g.id, g]));

    const guilds = await Promise.all(allIds.map(async (id) => {
      const r = await fetch(`https://discord.com/api/v10/guilds/${id}?with_counts=false`, {
        headers: { Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}` },
      });
      if (r.ok) {
        const data = await r.json() as { id: string; name: string; icon: string | null };
        return { id: data.id, name: data.name, icon: data.icon, botInstalled: true };
      }
      const fallback = cachedMap.get(id);
      return {
        id,
        name: fallback?.name ?? id,
        icon: fallback?.icon ?? null,
        botInstalled: false,
      };
    }));
    return c.json({ guilds });
  });

  const requireGuildAccess = async (c: any, next: any) => {
    const session: SessionPayload = c.var.session;
    const guildId = c.req.param("guildId");
    if (!guildId) return c.json({ error: "missing guildId" }, 400);
    const isAdminGuild = session.adminGuildIds.includes(guildId);
    const isManagerGuild = session.managerGuildIds.includes(guildId);
    if (!isAdminGuild && !isManagerGuild) return c.json({ error: "forbidden" }, 403);
    c.set("isAdminInGuild", isAdminGuild);
    return next();
  };

  app.use("/api/guilds/:guildId/*", requireGuildAccess);

  app.get("/api/guilds/:guildId/config", async (c) => {
    const guildId = c.req.param("guildId");
    const raw = await c.env.GUILDS.get(`g:${guildId}`, "json");
    return c.json(normalizeConfig(raw));
  });

  app.put("/api/guilds/:guildId/config", async (c) => {
    const guildId = c.req.param("guildId");
    const body = await c.req.json().catch(() => null);
    const parsed = ConfigSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid config", details: parsed.error.issues }, 400);

    const incoming = parsed.data as GuildConfig;
    const existing = normalizeConfig(await c.env.GUILDS.get(`g:${guildId}`, "json"));

    const isAdminInGuild = (c as any).var.isAdminInGuild as boolean;
    const next: GuildConfig = isAdminInGuild
      ? incoming
      : { ...incoming, dashboardManagerRoleIds: existing.dashboardManagerRoleIds };

    await c.env.GUILDS.put(`g:${guildId}`, JSON.stringify(next));
    return c.json(normalizeConfig(next));
  });

  app.get("/api/guilds/:guildId/roles", async (c) => {
    const guildId = c.req.param("guildId");
    const roles = await fetchGuildRoles(c.env.DISCORD_BOT_TOKEN, guildId);
    return c.json({ roles });
  });

  app.get("/api/guilds/:guildId/channels", async (c) => {
    const guildId = c.req.param("guildId");
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}` },
    });
    if (!r.ok) return c.json({ channels: [] });
    const data = await r.json() as Array<{ id: string; name: string; type: number }>;
    return c.json({ channels: data });
  });

  app.post("/api/guilds/:guildId/post-welcome", async (c) => {
    const guildId = c.req.param("guildId");
    const body = await c.req.json().catch(() => null) as { channelId?: string } | null;
    if (!body?.channelId) return c.json({ error: "missing channelId" }, 400);

    const cfg = normalizeConfig(await c.env.GUILDS.get(`g:${guildId}`, "json"));
    if (!cfg.verifiedRoleId) return c.json({ error: "set a verified role first" }, 400);

    const allowed = cfg.allowedCountries ?? [];
    const description = allowed.length > 0 ? `For citizens of: **${allowed.join(", ")}**.` : "";
    const payload = {
      embeds: [{ title: "Verify your War Era account", description, color: 0xc8821e }],
      components: [{
        type: 1,
        components: [{ type: 2, style: 1, label: "Verify", custom_id: "verify:start" }],
      }],
    };
    const res = await sendChannelMessage({
      botToken: c.env.DISCORD_BOT_TOKEN,
      channelId: body.channelId,
      payload,
    });
    if (!res.ok) return c.json({ error: `discord ${res.status}` }, 502);
    return c.json({ ok: true });
  });

  app.post("/api/guilds/:guildId/manual-verify", async (c) => {
    const guildId = c.req.param("guildId");
    const body = await c.req.json().catch(() => null) as {
      discordUserId?: string;
      wareraUsername?: string;
      wareraUserId?: string;
    } | null;
    if (!body?.discordUserId || (!body?.wareraUsername && !body?.wareraUserId)) {
      return c.json({ error: "missing inputs" }, 400);
    }

    let user;
    if (body.wareraUserId) {
      try { user = await fetchUserByIdSafe(body.wareraUserId); }
      catch { user = null; }
    } else {
      user = await resolveUsername(body.wareraUsername!);
    }
    if (!user) return c.json({ error: "no such War Era user" }, 404);

    const existing = await c.env.LINKS.get(`d:${body.discordUserId}`);
    if (existing) return c.json({ error: "discord user already linked" }, 409);
    const claimed = await c.env.LINKS.get(`w:${user._id}`);
    if (claimed) return c.json({ error: "War Era account already linked" }, 409);

    const cfg = normalizeConfig(await c.env.GUILDS.get(`g:${guildId}`, "json"));
    if (!cfg.verifiedRoleId) return c.json({ error: "set a verified role first" }, 400);

    const countryName = await getCountryName(c.env.LINKS, user.country);
    const level = user.leveling?.level;

    const needsGov = !!cfg.allowForeignGovernment || Object.keys(cfg.governmentRoles ?? {}).length > 0;
    let positions: ReturnType<typeof positionsHeldBy> = [];
    if (needsGov && user.country) {
      const gov = await fetchGovernment(user.country);
      positions = positionsHeldBy(gov, user._id);
    }

    const decision = decideVerification({ cfg, countryName, isForeignGov: positions.length > 0 });
    if (!decision.allowed) return c.json({ error: `not allowed: ${decision.reason}` }, 403);

    const baseRoles = decision.mode === "citizen"
      ? rolesForCitizen(cfg, countryName, level)
      : rolesForForeignGov(cfg, countryName!, level);
    const govRoles = decision.mode === "citizen" ? governmentRolesFor(cfg, positions) : [];
    const all = Array.from(new Set([...baseRoles, ...govRoles]));

    let assigned = 0;
    for (const roleId of all) {
      const r = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${body.discordUserId}/roles/${roleId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}`,
            "X-Audit-Log-Reason": "Manual verify via dashboard",
          },
        },
      );
      if (r.ok) assigned++;
    }
    if (assigned === 0) return c.json({ error: "no roles could be assigned (check bot role hierarchy)" }, 500);

    const link = {
      wareraUserId: user._id,
      wareraUsername: user.username,
      country: countryName ?? undefined,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    await Promise.all([
      c.env.LINKS.put(`d:${body.discordUserId}`, JSON.stringify(link)),
      c.env.LINKS.put(`w:${user._id}`, body.discordUserId),
    ]);

    return c.json({ ok: true, assigned, total: all.length });
  });

  app.get("/api/warera/countries", async (c) => {
    const names = await getCountryNames(c.env.LINKS);
    return c.json({ countries: names });
  });

  app.get("/api/guilds/:guildId/hierarchy", async (c) => {
    const guildId = c.req.param("guildId");
    const [rolesRes, memberRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}` },
      }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${c.env.DISCORD_APP_ID}`, {
        headers: { Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}` },
      }),
    ]);
    if (!rolesRes.ok || !memberRes.ok) {
      return c.json({ error: "bot not in this server", code: "bot-not-in-guild" }, 409);
    }
    const allGuildRoles = await rolesRes.json() as Array<{ id: string; name: string; position: number; managed: boolean }>;
    const botMember = await memberRes.json() as { roles: string[] };
    const cfg = normalizeConfig(await c.env.GUILDS.get(`g:${guildId}`, "json"));
    const configuredRoleIds = collectConfiguredRoleIds(cfg);
    const result = checkHierarchy({
      allGuildRoles,
      botMemberRoleIds: botMember.roles,
      configuredRoleIds,
    });
    return c.json(result);
  });

  app.get("/api/guilds/:guildId/members", async (c) => {
    const guildId = c.req.param("guildId");
    try {
      const rows = await buildMembersView(c.env, guildId);
      return c.json({ members: rows });
    } catch (e) {
      if (e instanceof GuildAccessError) {
        const reason = e.status === 403 || e.status === 401
          ? "bot is not in this server (or was kicked). Re-invite it to use the Members view."
          : `Discord returned ${e.status}`;
        return c.json({ error: reason, code: "bot-not-in-guild" }, 409);
      }
      console.error("members endpoint failed:", e);
      return c.json({ error: `members fetch failed: ${(e as Error).message ?? e}` }, 500);
    }
  });

  return app;
}

// silence unused import
void isAdmin;
void parsePermissions;
