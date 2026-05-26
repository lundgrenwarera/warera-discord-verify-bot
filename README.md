# War Era · Discord Verify

A Discord bot that lets a member prove they own a War Era account by renaming any one of their companies to a one-shot token. No screenshots, no mod approval, no impersonation.

Two apps in one monorepo:

| App | What | Where |
|---|---|---|
| `apps/bot` | Cloudflare Worker — Discord interactions + dashboard API | https://warera-discord-verify-bot.lundgrenlundgrensson.workers.dev |
| `apps/dashboard` | React + Vite SPA on Cloudflare Pages — admin config UI | https://warera-discord-verify-dashboard.pages.dev |

## Install the bot

[**Add to your server →**](https://discord.com/oauth2/authorize?client_id=1508781171218190456&permissions=268437504&scope=bot)

After installing, drag the **WarEra** bot role above any role you want it to assign in *Server Settings → Roles*, then open the dashboard to configure.

## How verification works

1. An admin posts the welcome message in the dashboard. The message has a **Verify** button.
2. A member clicks **Verify**, types their War Era username in the modal.
3. The bot returns a one-shot token like `WV-7K2M9X`.
4. The member renames any one of their companies in War Era to contain the token.
5. They click **Confirm**. The bot re-fetches their companies, matches the token, and assigns the configured roles.

Only the real account owner can rename their companies, so the rename is the proof. Tokens are random, single-use, expire in 15 minutes, and are bound to the Discord user who started the flow.

## Configuration (via dashboard)

Every server setting is at https://warera-discord-verify-dashboard.pages.dev. Sign in with Discord; you'll only see servers where you're an administrator or hold a configured manager role.

- **Verified role** — assigned on every successful verification
- **Who can verify** — restrict to one or more War Era countries
- **Roles per country** — extra roles per citizen country
- **Government roles** — auto-assign based on cabinet position (President, VP, MoD, MoE, MoFA, or "Anyone in government")
- **Foreign government bypass** — let cabinet members from other countries verify and get country-named roles (embassy mode)
- **Level gate** — withhold country roles below War Era level N (anti-multi)
- **Dashboard access** — grant non-admin roles permission to use the dashboard
- **Members tab** — see who's verified, who has tracked roles but isn't in the DB ("orphan"), and discrepancies (country changed, gov role stale, username mismatch); one-click manual-link for orphans
- **Manual verify** — for permamuted accounts that can't rename, admins attest and skip the rename step

## Rate limits

- Per Discord user: 3 verification starts/hour, 10 confirm attempts/hour
- Per War Era username (across all Discord users): 5 lookups per 10 minutes
- Global outbound API budget: 200 calls/min

## Self-host

```bash
pnpm install
pnpm -r typecheck && pnpm -r test
cd apps/bot
pnpm wrangler kv namespace create TOKENS
pnpm wrangler kv namespace create LINKS
pnpm wrangler kv namespace create GUILDS
# paste IDs into wrangler.toml, then:
pnpm wrangler secret put DISCORD_PUBLIC_KEY
pnpm wrangler secret put DISCORD_APP_ID
pnpm wrangler secret put DISCORD_BOT_TOKEN
pnpm wrangler secret put DISCORD_CLIENT_SECRET
pnpm wrangler secret put JWT_SECRET   # any 32+ char random string
pnpm wrangler secret put DASHBOARD_ORIGIN   # your dashboard URL
pnpm deploy
# wire the worker URL into Discord application's Interactions Endpoint URL
```

For the dashboard, deploy to Cloudflare Pages from `apps/dashboard/dist` (built via `pnpm build`).

## Development

```bash
pnpm install
pnpm dev          # turbo: starts wrangler dev for the bot + vite dev for the dashboard
pnpm typecheck    # both apps
pnpm test         # bot's vitest suite
```

## License

MIT. Not affiliated with War Era.
