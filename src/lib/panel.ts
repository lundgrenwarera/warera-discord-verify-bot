import type { GovernmentBucket, GuildConfig } from "../types";
import { GOVERNMENT_BUCKET_LABELS, GOVERNMENT_BUCKETS } from "../types";
import { ButtonStyle, button, roleSelect, row, stringSelect } from "./components";
import { COLOR_PRIMARY, CREDIT_AUTHOR } from "./messages";

export type PanelKind =
  | { kind: "main" }
  | { kind: "country-roles"; country?: string }
  | { kind: "gov-roles"; bucket?: GovernmentBucket }
  | { kind: "foreign-gov"; country?: string };

export interface PanelPayload {
  embeds: unknown[];
  components: unknown[];
}

const STATUS_OK = "🟢";
const STATUS_OFF = "⚫";

function statusEmbed(cfg: GuildConfig) {
  const lines = [
    `${cfg.verifiedRoleId ? STATUS_OK : STATUS_OFF} **Verified role**: ${cfg.verifiedRoleId ? `<@&${cfg.verifiedRoleId}>` : "_not set_"}`,
    `${(cfg.allowedCountries?.length ?? 0) > 0 ? STATUS_OK : STATUS_OFF} **Allowed countries**: ${cfg.allowedCountries?.length ? cfg.allowedCountries.join(", ") : "_any_"}`,
    `${Object.keys(cfg.countryRoles ?? {}).length > 0 ? STATUS_OK : STATUS_OFF} **Country roles**: ${Object.keys(cfg.countryRoles ?? {}).length} configured`,
    `${Object.keys(cfg.governmentRoles ?? {}).length > 0 ? STATUS_OK : STATUS_OFF} **Government roles**: ${Object.keys(cfg.governmentRoles ?? {}).length} buckets`,
    `${cfg.allowForeignGovernment ? STATUS_OK : STATUS_OFF} **Foreign gov bypass**: ${cfg.allowForeignGovernment ? "enabled" : "disabled"} (${Object.keys(cfg.foreignCountryRoles ?? {}).length} countries)`,
    `${cfg.minLevel ? STATUS_OK : STATUS_OFF} **Min level for country roles**: ${cfg.minLevel ? cfg.minLevel : "_none_"}`,
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
        placeholder: cfg.verifiedRoleId ? "Change the verified role" : "Pick the verified role",
      })),
      row(
        button({ custom_id: "setup:countries", label: "Allowed countries", emoji: "🌍" }),
        button({ custom_id: "setup:country-roles", label: "Country roles", emoji: "🏷️" }),
        button({ custom_id: "setup:gov-roles", label: "Government roles", emoji: "🏛️" }),
      ),
      row(
        button({ custom_id: "setup:foreign-gov", label: "Foreign government", emoji: "🌐" }),
        button({ custom_id: "setup:min-level", label: cfg.minLevel ? `Min level: ${cfg.minLevel}` : "Min level for country roles", emoji: "🎚️" }),
        button({ custom_id: "setup:post-welcome", label: "Post welcome here", style: ButtonStyle.Success, emoji: "📣", disabled: !cfg.verifiedRoleId }),
      ),
      row(
        button({ custom_id: "setup:show-config", label: "Show raw config" }),
        button({ custom_id: "setup:reset", label: "Reset config", style: ButtonStyle.Danger, emoji: "🗑️" }),
      ),
    ],
  };
}

export function countriesPanel(cfg: GuildConfig): PanelPayload {
  const allowed = cfg.allowedCountries ?? [];
  const description = allowed.length === 0
    ? "_No restrictions. Anyone with a verified War Era account can verify._"
    : allowed.map((c) => `• ${c}`).join("\n");
  return {
    embeds: [{
      title: "Allowed countries",
      description,
      color: COLOR_PRIMARY,
      footer: { text: "Citizens of these countries can verify. Foreign government bypass is configured separately." },
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
      row(button({ custom_id: "setup:back", label: "← Back", style: ButtonStyle.Secondary })),
    ],
  };
}

export function countryRolesPanel(cfg: GuildConfig, country: string | undefined): PanelPayload {
  if (!country) {
    const countries = Object.keys(cfg.countryRoles ?? {}).sort();
    const allowed = cfg.allowedCountries ?? [];
    const editable = Array.from(new Set([...allowed, ...countries])).sort();
    const lines = countries.length === 0
      ? ["_No per-country roles configured._"]
      : Object.entries(cfg.countryRoles ?? {})
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([c, roles]) => `**${c}**: ${roles.map((id) => `<@&${id}>`).join(", ")}`);
    return {
      embeds: [{
        title: "Country roles",
        description: lines.join("\n"),
        color: COLOR_PRIMARY,
        footer: { text: "Extra roles assigned to verified citizens of a specific country." },
      }],
      components: [
        ...(editable.length > 0 ? [row(stringSelect({
          custom_id: "setup:country-role:pick",
          placeholder: "Pick a country to manage",
          options: editable.map((c) => ({ label: c, value: c })),
        }))] : []),
        row(
          button({ custom_id: "setup:country-role:add-country", label: "Manage a different country", emoji: "🌍" }),
          button({ custom_id: "setup:back", label: "← Back" }),
        ),
      ],
    };
  }

  const roles = cfg.countryRoles?.[country] ?? [];
  return {
    embeds: [{
      title: `Country roles — ${country}`,
      description: roles.length === 0
        ? "_No roles set for this country yet._"
        : roles.map((id) => `• <@&${id}>`).join("\n"),
      color: COLOR_PRIMARY,
    }],
    components: [
      row(roleSelect({
        custom_id: `setup:country-role:add:${country}`,
        placeholder: "Add a role for citizens of this country",
      })),
      ...(roles.length > 0 ? [row(stringSelect({
        custom_id: `setup:country-role:remove:${country}`,
        placeholder: "Remove a role",
        options: roles.map((id) => ({ label: id, value: id })),
      }))] : []),
      row(
        button({ custom_id: "setup:country-roles", label: "Pick different country" }),
        button({ custom_id: "setup:back", label: "← Back" }),
      ),
    ],
  };
}

export function govRolesPanel(cfg: GuildConfig, bucket: GovernmentBucket | undefined): PanelPayload {
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
        footer: { text: "Assigned when a verified citizen holds a government position. Use 'Anyone in government' for a single catch-all role." },
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
      title: `Government roles — ${GOVERNMENT_BUCKET_LABELS[bucket]}`,
      description: list.length === 0
        ? "_No roles set yet._"
        : list.map((id) => `• <@&${id}>`).join("\n"),
      color: COLOR_PRIMARY,
    }],
    components: [
      row(roleSelect({
        custom_id: `setup:gov-role:add:${bucket}`,
        placeholder: "Add a role to this position",
      })),
      ...(list.length > 0 ? [row(stringSelect({
        custom_id: `setup:gov-role:remove:${bucket}`,
        placeholder: "Remove a role",
        options: list.map((id) => ({ label: id, value: id })),
      }))] : []),
      row(
        button({ custom_id: "setup:gov-roles", label: "Pick different position" }),
        button({ custom_id: "setup:back", label: "← Back" }),
      ),
    ],
  };
}

export function foreignGovPanel(cfg: GuildConfig, country: string | undefined): PanelPayload {
  if (!country) {
    const countries = Object.keys(cfg.foreignCountryRoles ?? {}).sort();
    const lines = [
      `Foreign government bypass: **${cfg.allowForeignGovernment ? "enabled" : "disabled"}**.`,
      "",
      countries.length === 0
        ? "_No foreign country roles configured. When the bypass is enabled, foreign gov members will verify but get only the base verified role until you add per-country roles here._"
        : countries.map((c) => {
            const roles = cfg.foreignCountryRoles?.[c] ?? [];
            return `**${c}**: ${roles.map((id) => `<@&${id}>`).join(", ")}`;
          }).join("\n"),
    ];
    return {
      embeds: [{
        title: "Foreign government bypass",
        description: lines.join("\n"),
        color: COLOR_PRIMARY,
        footer: { text: "Lets people in another country's government verify even if their country isn't in your allowed list." },
      }],
      components: [
        row(
          button({
            custom_id: "setup:foreign-gov:toggle",
            label: cfg.allowForeignGovernment ? "Disable bypass" : "Enable bypass",
            style: cfg.allowForeignGovernment ? ButtonStyle.Danger : ButtonStyle.Success,
          }),
          button({ custom_id: "setup:foreign-gov:add-country", label: "Add foreign country", style: ButtonStyle.Success, emoji: "➕" }),
        ),
        ...(countries.length > 0 ? [row(stringSelect({
          custom_id: "setup:foreign-gov:pick",
          placeholder: "Pick a country to manage",
          options: countries.map((c) => ({ label: c, value: c })),
        }))] : []),
        row(button({ custom_id: "setup:back", label: "← Back" })),
      ],
    };
  }

  const roles = cfg.foreignCountryRoles?.[country] ?? [];
  return {
    embeds: [{
      title: `Foreign country roles — ${country}`,
      description: roles.length === 0
        ? "_No roles set for this country yet._"
        : roles.map((id) => `• <@&${id}>`).join("\n"),
      color: COLOR_PRIMARY,
    }],
    components: [
      row(roleSelect({
        custom_id: `setup:foreign-gov:add-role:${country}`,
        placeholder: "Add a role for foreign gov members from this country",
      })),
      ...(roles.length > 0 ? [row(stringSelect({
        custom_id: `setup:foreign-gov:remove-role:${country}`,
        placeholder: "Remove a role",
        options: roles.map((id) => ({ label: id, value: id })),
      }))] : []),
      row(
        button({ custom_id: "setup:foreign-gov", label: "Pick different country" }),
        button({ custom_id: "setup:back", label: "← Back" }),
      ),
    ],
  };
}

export function renderPanel(kind: PanelKind, cfg: GuildConfig): PanelPayload {
  switch (kind.kind) {
    case "main": return mainPanel(cfg);
    case "country-roles": return countryRolesPanel(cfg, kind.country);
    case "gov-roles": return govRolesPanel(cfg, kind.bucket);
    case "foreign-gov": return foreignGovPanel(cfg, kind.country);
  }
}
