# War Era Discord Verify Bot

A Discord bot that verifies War Era account ownership automatically. No moderator approval, no screenshots, no manual review. Runs on Cloudflare Workers.

## How verification works

1. Admin posts a welcome message in any channel (see Setup below). The message has a **Verify** button.
2. A new member clicks **Verify**. A modal pops up asking for their War Era username.
3. The bot looks up the account, fetches their companies, and replies with a one-shot token like `WV-7K2M9X`.
4. The user renames any one of their companies in War Era to include the token, then clicks **Confirm**.
5. The bot re-fetches the companies, finds the token, assigns the verified role (and any country-specific roles), and the user is done. They can rename the company back to whatever they like.

The mechanism proves ownership because only the actual account owner can rename their companies. Tokens are cryptographically random (32-char alphabet, 6 chars), expire in 15 minutes, are bound to the Discord user who started the flow, and are deleted after a successful match.

## Commands

| Command | Who | What |
|---|---|---|
| `/verify username:<name>` | Anyone | Start verification with the username inline. The Verify-button flow is usually nicer. |
| `/verify-config show` | Admins | Show this server's current config |
| `/verify-config set-verified-role role:@Verified` | Admins | Required. Role assigned to anyone who passes verification. |
| `/verify-config allow-country country:Netherlands` | Admins | Restrict verification to specific War Era countries. Run multiple times to allow multiple. Country names autocomplete. |
| `/verify-config disallow-country country:Netherlands` | Admins | Remove a country from the allow-list |
| `/verify-config add-country-role country:Netherlands role:@Citizen` | Admins | Extra role for users of a specific country (in addition to the verified role) |
| `/verify-config remove-country-role country:Netherlands role:@Citizen` | Admins | Undo |
| `/verify-config post-welcome` | Admins | Post the welcome message with the Verify button into the current channel |
| `/verify-config reset` | Admins | Wipe all verification config for this server |
| `/whois user:<member>` or `/whois username:<name>` | Mods | Look up a verified link |
| `/unverify [user:<member>]` | Anyone (self), admins (others) | Remove a verification link |

## Example: setting up an NL Discord

```
/verify-config set-verified-role role:@Verified
/verify-config allow-country country:Netherlands
/verify-config post-welcome
```

Done. Only Dutch citizens can verify, they get `@Verified`, the welcome message lives in whatever channel you ran `post-welcome` in.

Multi-country (NL + BE embassy):

```
/verify-config set-verified-role role:@Verified
/verify-config allow-country country:Netherlands
/verify-config allow-country country:Belgium
/verify-config add-country-role country:Netherlands role:@Dutch
/verify-config add-country-role country:Belgium role:@BelgianEmbassy
/verify-config post-welcome
```

Dutch users get `@Verified` + `@Dutch`. Belgians get `@Verified` + `@BelgianEmbassy`. Other countries are rejected.

## Self-host setup

1. **Create the Discord application** at https://discord.com/developers/applications. Note the Application ID, Public Key, and Bot Token.
2. **Create the Cloudflare Worker**:
   ```bash
   pnpm install
   pnpm wrangler kv namespace create TOKENS
   pnpm wrangler kv namespace create LINKS
   pnpm wrangler kv namespace create GUILDS
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
   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... pnpm register-commands
   ```
6. **Wire Discord to the worker**: copy the worker URL into the Discord application's "Interactions Endpoint URL" field. Discord will ping it to verify.
7. **Install the bot** to your Discord server with an OAuth URL. Required bot permissions: `Manage Roles` and `Send Messages`. Example URL pattern:
   ```
   https://discord.com/oauth2/authorize?client_id=<APP_ID>&permissions=268437504&scope=bot+applications.commands
   ```
8. **In your server**, drag the bot's role above any role it needs to assign in Server Settings → Roles. Run `/verify-config set-verified-role` and `/verify-config post-welcome` to get started.

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
