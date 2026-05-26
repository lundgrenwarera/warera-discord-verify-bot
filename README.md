# War Era Discord Verify Bot

A Discord bot that verifies War Era account ownership automatically. No moderator approval, no screenshots, no manual review. Runs on Cloudflare Workers.

## How verification works

1. User runs `/verify username:lundgren` in your Discord server.
2. The bot looks up the War Era account, fetches their factories, and generates a unique short-lived token like `WV-7K2M9X`.
3. User renames any one of their factories in War Era to include that token.
4. User clicks **Confirm**. The bot re-fetches their factories and checks for the token.
5. On match: the bot writes the Discord ↔ War Era link to KV, assigns the verified role (and country role if configured), and tells the user they can rename the factory back.

The mechanism proves ownership because only the actual account owner can rename their factories. Tokens are cryptographically random (32-char alphabet, 6 chars), expire in 15 minutes, are bound to the Discord user who started the flow, and are deleted after a successful match.

## Commands

| Command | Who | What |
|---|---|---|
| `/verify username:<name>` | Anyone | Start verification for a War Era username |
| `/verify-setup verified_role:<role> [country_roles:<json>]` | Server admins | Configure which Discord role to assign on verification, and optionally restrict to specific War Era countries |
| `/whois user:<member>` or `/whois username:<name>` | Mods | Look up a verified link |
| `/unverify [user:<member>]` | Anyone (self), admins (others) | Remove a verification link |

## Country restriction

If you pass `country_roles` to `/verify-setup`, only members from those countries can verify. Example for a Dutch server:

```
/verify-setup verified_role:@Verified country_roles:{"Netherlands":"123456789012345678"}
```

Multiple countries (citizens + embassies):

```
country_roles:{"Netherlands":"<citizen-role-id>","Belgium":"<embassy-role-id>"}
```

If `country_roles` is empty or not set, any War Era user can verify and just gets the `verified_role`.

## Self-host setup

1. **Create the Discord application** at https://discord.com/developers/applications. Note the Application ID, Public Key, and Bot Token.
2. **Create the Cloudflare Worker**:
   ```bash
   pnpm install
   pnpm wrangler kv:namespace create TOKENS
   pnpm wrangler kv:namespace create LINKS
   pnpm wrangler kv:namespace create GUILDS
   ```
   Paste the returned IDs into `wrangler.toml`.
3. **Set secrets**:
   ```bash
   pnpm wrangler secret put DISCORD_PUBLIC_KEY
   pnpm wrangler secret put DISCORD_APP_ID
   pnpm wrangler secret put DISCORD_BOT_TOKEN
   ```
4. **Deploy**:
   ```bash
   pnpm deploy
   ```
5. **Register the slash commands** (one-time, takes up to an hour to propagate globally):
   ```bash
   cp .dev.vars.example .dev.vars   # then fill in your IDs
   pnpm register-commands
   ```
6. **Wire Discord to the worker**: copy the worker URL into the Discord application's "Interactions Endpoint URL" field. Discord will ping it to verify.
7. **Install the bot** to your Discord server with the OAuth URL (scopes: `bot` `applications.commands`, permissions: `Manage Roles`).

## Rate limits

The bot enforces several layers to keep the War Era API healthy:

- Per Discord user: max 3 `/verify` calls per hour, max 10 confirm attempts per hour
- Per War Era username (across all Discord users): max 5 lookups per 10 minutes
- Global API call budget: ~200 outbound calls per minute (matches the War Era public limit)

Limits are KV-backed with TTL cleanup, no extra infra needed.

## Why this is better than manual approval

Most country Discords today rely on a moderator vetting screenshots or asking the user questions to confirm they own the in-game account. That's slow and fakeable. This bot turns the question "are you really that War Era account" into a cryptographic challenge with a 15-minute window. Mods can stay focused on community moderation; the bot handles identity.

## License

MIT. Not affiliated with War Era.
