import type { GovernmentBucket, GuildConfig } from "../types";
import { GOVERNMENT_BUCKET_LABELS, GOVERNMENT_BUCKETS } from "../types";
import { ButtonStyle, button, roleSelect, row, stringSelect } from "./components";
import { COLOR_PRIMARY, CREDIT_AUTHOR } from "./messages";
import { roleLabel, type RoleMap } from "./role-cache";

export type PanelKind =
  | { kind: "main" }
  | { kind: "countries" }
  | { kind: "country-roles"; country?: string }
  | { kind: "gov-roles"; bucket?: GovernmentBucket }
  | { kind: "foreign-gov"; country?: string };

export interface PanelPayload {
  embeds: unknown[];
  components: unknown[];
}

export interface PanelContext {
  cfg: GuildConfig;
  roleNames: RoleMap;
}

const STATUS_OK = "🟢";
const STATUS_OFF = "⚫";

function statusEmbed(cfg: GuildConfig) {
  const countryCount = Object.keys(cfg.countryRoles ?? {}).length;
  const govCount = Object.keys(cfg.governmentRoles ?? {}).length;
  const foreignCount = Object.keys(cfg.foreignCountryRoles ?? {}).length;
  const lines = [
    `${cfg.verifiedRoleId ? STATUS_OK : STATUS_OFF} **Verified role**: ${cfg.verifiedRoleId ? `<@&${cfg.verifiedRoleId}>` : "_not set — pick one to start_"}`,
    `${(cfg.allowedCountries?.length ?? 0) > 0 ? STATUS_OK : STATUS_OFF} **Who can verify**: ${cfg.allowedCountries?.length ? `citizens of ${cfg.allowedCountries.join(", ")}` : "_anyone with a War Era account_"}`,
    `${countryCount > 0 ? STATUS_OK : STATUS_OFF} **Country roles**: ${countryCount === 0 ? "_none_" : `${countryCount} configured`}`,
    `${govCount > 0 ? STATUS_OK : STATUS_OFF} **Government roles**: ${govCount === 0 ? "_none_" : `${govCount} position${govCount === 1 ? "" : "s"} configured`}`,
    `${cfg.allowForeignGovernment ? STATUS_OK : STATUS_OFF} **Foreign government bypass**: ${cfg.allowForeignGovernment ? `**on** (${foreignCount} ${foreignCount === 1 ? "country" : "countries"})` : "_off_"}`,
    `${cfg.minLevel ? STATUS_OK : STATUS_OFF} **Anti-multi level gate**: ${cfg.minLevel ? `country roles only assigned at lvl ${cfg.minLevel}+` : "_off_"}`,
  ];
  return {
    title: "Verify Bot setup",
    description: lines.join("\n"),
    color: COLOR_PRIMARY,
    author: CREDIT_AUTHOR,
  };
}

export function mainPanel(cfg: GuildConfig): PanelPayload {
  return {
    embeds: [statusEmbed(cfg)],
    components: [
      row(roleSelect({
        custom_id: "setup:verified-role",
        placeholder: cfg.verifiedRoleId ? "Change the verified role" : "Step 1: pick the verified role",
      })),
      row(
        button({ custom_id: "setup:countries", label: "Who can verify", emoji: "🌍" }),
        button({ custom_id: "setup:country-roles", label: "Roles per country", emoji: "🏷️" }),
        button({ custom_id: "setup:gov-roles", label: "Government roles", emoji: "🏛️" }),
      ),
      row(
        button({ custom_id: "setup:foreign-gov", label: "Foreign government", emoji: "🌐" }),
        button({ custom_id: "setup:min-level", label: cfg.minLevel ? `Level gate: ${cfg.minLevel}+` : "Level gate", emoji: "🎚️" }),
        button({ custom_id: "setup:post-welcome", label: "Post verify message here", style: ButtonStyle.Success, emoji: "📣", disabled: !cfg.verifiedRoleId }),
      ),
      row(
        button({ custom_id: "setup:show-config", label: "Raw config" }),
        button({ custom_id: "setup:reset", label: "Reset everything", style: ButtonStyle.Danger, emoji: "🗑️" }),
      ),
    ],
  };
}

export function countriesPanel(cfg: GuildConfig): PanelPayload {
  const allowed = cfg.allowedCountries ?? [];
  const description = allowed.length === 0
    ? "_Anyone with a verified War Era account can verify. Add countries to restrict._"
    : `Citizens of these countries can verify:\n${allowed.map((c) => `• ${c}`).join("\n")}`;
  return {
    embeds: [{
      title: "Who can verify",
      description,
      color: COLOR_PRIMARY,
      footer: { text: "Foreign government members are configured separately — see the Foreign government button on the main panel." },
    }],
    components: [
      row(
        button({ custom_id: "setup:country:add", label: "Add country", style: ButtonStyle.Success, emoji: "➕" }),
        button({
          custom_id: "setup:country:remove-pick",
          label: "Remove country",
          style: ButtonStyle.Danger,
          emoji: "➖",
          disabled: allowed.length === 0,
        }),
      ),
      row(button({ custom_id: "setup:back", label: "← Back" })),
    ],
  };
}

export function countryRolesPanel(
  ctx: PanelContext,
  country: string | undefined,
): PanelPayload {
  const { cfg, roleNames } = ctx;
  if (!country) {
    const configured = Object.keys(cfg.countryRoles ?? {}).sort();
    const allowed = cfg.allowedCountries ?? [];
    const choices = Array.from(new Set([...allowed, ...configured])).sort();
    const lines = configured.length === 0
      ? ["_No per-country roles yet._", "", "Pick a country below to assign one."]
      : Object.entries(cfg.countryRoles ?? {})
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([c, roles]) => `**${c}**: ${roles.map((id) => `<@&${id}>`).join(", ")}`);
    return {
      embeds: [{
        title: "Roles per country",
        description: lines.join("\n"),
        color: COLOR_PRIMARY,
        footer: { text: "Extra roles assigned to verified citizens of a specific country, on top of the base verified role." },
      }],
      components: [
        ...(choices.length > 0 ? [row(stringSelect({
          custom_id: "setup:country-role:pick",
          placeholder: "Pick a country",
          options: choices.map((c) => ({ label: c, value: c })),
        }))] : []),
        row(
          button({ custom_id: "setup:country-role:add-country", label: "Other country…", emoji: "🌍" }),
          button({ custom_id: "setup:back", label: "← Back" }),
        ),
      ],
    };
  }

  const roles = cfg.countryRoles?.[country] ?? [];
  return {
    embeds: [{
      title: `${country} — extra roles`,
      description: roles.length === 0
        ? "_No extra roles for this country yet. Use the dropdown below to add one._"
        : roles.map((id) => `• <@&${id}>`).join("\n"),
      color: COLOR_PRIMARY,
    }],
    components: [
      row(roleSelect({
        custom_id: `setup:country-role:add:${country}`,
        placeholder: `Add a role for citizens of ${country}`,
      })),
      ...(roles.length > 0 ? [row(stringSelect({
        custom_id: `setup:country-role:remove:${country}`,
        placeholder: "Remove a role",
        options: roles.map((id) => ({ label: roleLabel(id, roleNames), value: id })),
      }))] : []),
      row(
        button({ custom_id: "setup:country-roles", label: "Pick different country" }),
        button({ custom_id: "setup:back", label: "← Back" }),
      ),
    ],
  };
}

export function govRolesPanel(
  ctx: PanelContext,
  bucket: GovernmentBucket | undefined,
): PanelPayload {
  const { cfg, roleNames } = ctx;
  if (!bucket) {
    const lines = GOVERNMENT_BUCKETS.map((b) => {
      const list = cfg.governmentRoles?.[b];
      const summary = list && list.length > 0 ? list.map((id) => `<@&${id}>`).join(", ") : "_(none)_";
      return `**${GOVERNMENT_BUCKET_LABELS[b]}**: ${summary}`;
    });
    return {
      embeds: [{
        title: "Government roles",
        description: lines.join("\n"),
        color: COLOR_PRIMARY,
        footer: { text: "Tip: use 'Anyone in government' for a single @Cabinet role that applies to anyone holding any cabinet position." },
      }],
      components: [
        row(stringSelect({
          custom_id: "setup:gov-role:pick",
          placeholder: "Pick a position to manage",
          options: GOVERNMENT_BUCKETS.map((b) => ({ label: GOVERNMENT_BUCKET_LABELS[b], value: b })),
        })),
        row(button({ custom_id: "setup:back", label: "← Back" })),
      ],
    };
  }

  const list = cfg.governmentRoles?.[bucket] ?? [];
  return {
    embeds: [{
      title: `${GOVERNMENT_BUCKET_LABELS[bucket]} — assigned roles`,
      description: list.length === 0
        ? "_No roles set yet. Use the dropdown below to add one._"
        : list.map((id) => `• <@&${id}>`).join("\n"),
      color: COLOR_PRIMARY,
    }],
    components: [
      row(roleSelect({
        custom_id: `setup:gov-role:add:${bucket}`,
        placeholder: `Add a role for ${GOVERNMENT_BUCKET_LABELS[bucket]}`,
      })),
      ...(list.length > 0 ? [row(stringSelect({
        custom_id: `setup:gov-role:remove:${bucket}`,
        placeholder: "Remove a role",
        options: list.map((id) => ({ label: roleLabel(id, roleNames), value: id })),
      }))] : []),
      row(
        button({ custom_id: "setup:gov-roles", label: "Pick different position" }),
        button({ custom_id: "setup:back", label: "← Back" }),
      ),
    ],
  };
}

export function foreignGovPanel(
  ctx: PanelContext,
  country: string | undefined,
): PanelPayload {
  const { cfg, roleNames } = ctx;
  if (!country) {
    const countries = Object.keys(cfg.foreignCountryRoles ?? {}).sort();
    const lines = [
      `Foreign government bypass is currently **${cfg.allowForeignGovernment ? "on" : "off"}**.`,
      "",
      cfg.allowForeignGovernment
        ? "When on, cabinet members from other countries can verify here even if their country isn't in your allow-list."
        : "When off, only people from your allowed countries can verify. Turn it on if you want embassy roles.",
      "",
      countries.length === 0
        ? "_No per-country roles configured yet._"
        : `Country roles configured:\n${countries.map((c) => {
            const roles = cfg.foreignCountryRoles?.[c] ?? [];
            return `**${c}**: ${roles.map((id) => `<@&${id}>`).join(", ")}`;
          }).join("\n")}`,
    ];
    return {
      embeds: [{
        title: "Foreign government",
        description: lines.join("\n"),
        color: COLOR_PRIMARY,
      }],
      components: [
        row(
          button({
            custom_id: "setup:foreign-gov:toggle",
            label: cfg.allowForeignGovernment ? "Turn bypass off" : "Turn bypass on",
            style: cfg.allowForeignGovernment ? ButtonStyle.Danger : ButtonStyle.Success,
          }),
          button({ custom_id: "setup:foreign-gov:add-country", label: "Add country", style: ButtonStyle.Success, emoji: "➕" }),
        ),
        ...(countries.length > 0 ? [row(stringSelect({
          custom_id: "setup:foreign-gov:pick",
          placeholder: "Manage a country",
          options: countries.map((c) => ({ label: c, value: c })),
        }))] : []),
        row(button({ custom_id: "setup:back", label: "← Back" })),
      ],
    };
  }

  const roles = cfg.foreignCountryRoles?.[country] ?? [];
  return {
    embeds: [{
      title: `${country} — foreign government roles`,
      description: roles.length === 0
        ? `_No roles set for ${country} yet. Add one below to give cabinet members from this country a role._`
        : roles.map((id) => `• <@&${id}>`).join("\n"),
      color: COLOR_PRIMARY,
    }],
    components: [
      row(roleSelect({
        custom_id: `setup:foreign-gov:add-role:${country}`,
        placeholder: `Add a role for cabinet members from ${country}`,
      })),
      ...(roles.length > 0 ? [row(stringSelect({
        custom_id: `setup:foreign-gov:remove-role:${country}`,
        placeholder: "Remove a role",
        options: roles.map((id) => ({ label: roleLabel(id, roleNames), value: id })),
      }))] : []),
      row(
        button({ custom_id: "setup:foreign-gov", label: "Pick different country" }),
        button({ custom_id: "setup:back", label: "← Back" }),
      ),
    ],
  };
}

export function renderPanel(kind: PanelKind, ctx: PanelContext): PanelPayload {
  switch (kind.kind) {
    case "main": return mainPanel(ctx.cfg);
    case "countries": return countriesPanel(ctx.cfg);
    case "country-roles": return countryRolesPanel(ctx, kind.country);
    case "gov-roles": return govRolesPanel(ctx, kind.bucket);
    case "foreign-gov": return foreignGovPanel(ctx, kind.country);
  }
}
