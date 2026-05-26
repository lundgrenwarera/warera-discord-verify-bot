# War Era Discord Verify Bot

A Discord bot that verifies someone owns their War Era account by asking them to rename one of their companies to a one-shot token. No screenshots, no mod approval, no manual review. Runs on Cloudflare Workers.

## One-click install

[**Add the bot to your server →**](https://discord.com/oauth2/authorize?client_id=1508781171218190456&permissions=268437504&scope=bot+applications.commands)

After installing, drag the **WarEra** bot role above any role you want it to assign (Server Settings → Roles), then run `/verify-setup`.

## The three slash commands

| Command | Who | What it does |
|---|---|---|
| `/verify-setup` | Admins | Opens the interactive setup panel for the whole bot |
| `/whois` | Mods | Look up the War Era account linked to a Discord user, or vice versa |
| `/unverify` | Self / admins | Remove a verification link |

Everything else is buttons inside `/verify-setup`. There are no other slash commands.

## How a user verifies

1. They click the **Verify** button on the welcome message you posted (via `/verify-setup`).
2. A modal pops up. They type their War Era username and submit.
3. The bot returns a token like `WV-7K2M9X` and tells them to rename any one of their companies in War Era to contain that token.
4. They rename, click **Confirm**, and the bot assigns their roles.
5. They can rename the company back to whatever they like.

The rename is the proof. Only the real account owner can rename their companies. Tokens are random, single-use, expire in 15 minutes, and are bound to the Discord user that started the flow.

## Setting up your server with `/verify-setup`

`/verify-setup` opens an ephemeral panel with a status overview and buttons for every setting. The flow:

1. **Pick the verified role.** Click the role dropdown at the top of the panel. Every successful verification gets this role.
2. **(Optional) Restrict to specific countries.** Click *Allowed countries* and add the War Era countries you want. Leave empty to allow anyone with a War Era account.
3. **(Optional) Per-country roles.** Click *Country roles* to assign an extra role per allowed country, e.g. citizens of Sweden also get `@Sweden`.
4. **(Optional) Government roles.** Click *Government roles* to assign roles when a verified user holds a cabinet position (President, VP, MoD, MoE, MoFA) in their country. Use the **Anyone in government** bucket for a single `@Cabinet` role across all positions.
5. **(Optional) Foreign government bypass.** Click *Foreign government* to let people in another country's cabinet verify even if their country isn't in your allow-list. Useful for embassy servers. You can assign country-named roles like `@Portugal`.
6. **Post the welcome message.** Click *Post welcome here* in the channel where you want the Verify button to live.

The panel is ephemeral (only you see it). Re-run `/verify-setup` any time to see the current state and make changes.

## Example: a country Discord (Sweden)

1. Run `/verify-setup` in any admin-only channel.
2. Pick `@Verified` as the verified role.
3. Open *Allowed countries* → add **Sweden**.
4. Open *Country roles* → add `@Swede` for Sweden.
5. Open *Government roles*:
   - Add `@Cabinet` to the **Anyone in government** bucket.
   - Optionally add `@President` to the **President** bucket, etc.
6. Open *Foreign government* → **Enable bypass**.
7. Open *Foreign government* → add a row for Portugal with role `@Portugal`, etc., for any country whose cabinet you want represented.
8. Run `/verify-setup` again in the channel where new members land. Click *Post welcome here*.

Result: Swedes get `@Verified` + `@Swede` (+ `@Cabinet`/`@President` if they're in the cabinet). Portuguese cabinet members can also verify and get `@Verified` + `@Portugal`.

## Rate limits

- Per Discord user: 3 verification starts per hour, 10 confirm attempts per hour
- Per War Era username (across all Discord users): 5 lookups per 10 minutes
- Global outbound API budget: 200 calls per minute (matches the War Era public limit)

KV-backed with TTL expiry, no extra infra needed.

## Why this is better than manual approval

Most country Discords today rely on a mod vetting screenshots or asking questions to confirm someone owns their in-game account. That's slow and fakeable. This bot turns the question "are you really that War Era account" into a cryptographic challenge with a 15-minute window. Mods handle community moderation; the bot handles identity.

## Self-host

Skip if you're using the hosted bot above. To run your own copy on Cloudflare's free tier:

1. **Discord application** at https://discord.com/developers/applications. Note the Application ID, Public Key, Bot Token.
2. **Worker setup:**
   ```bash
   pnpm install
   pnpm wrangler kv namespace create TOKENS
   pnpm wrangler kv namespace create LINKS
   pnpm wrangler kv namespace create GUILDS
   ```
   Paste the returned IDs into `wrangler.toml`.
3. **Secrets:**
   ```bash
   pnpm wrangler secret put DISCORD_PUBLIC_KEY
   pnpm wrangler secret put DISCORD_APP_ID
   pnpm wrangler secret put DISCORD_BOT_TOKEN
   ```
4. **Deploy:** `pnpm deploy`
5. **Register slash commands** (global, propagates in <1h):
   ```bash
   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... pnpm register-commands
   ```
6. **Wire Discord:** copy your worker URL into the Discord application's *Interactions Endpoint URL*.
7. **Install to a server** using your OAuth URL (replace `<APP_ID>`):
   ```
   https://discord.com/oauth2/authorize?client_id=<APP_ID>&permissions=268437504&scope=bot+applications.commands
   ```
8. **Drag the bot role above any role it needs to assign** (Server Settings → Roles), then run `/verify-setup`.

## Development

```bash
pnpm install
pnpm test           # vitest, ~60 tests covering schema, role logic, signature verification, rate-limit, etc.
pnpm typecheck      # tsc --noEmit, strict mode
pnpm dev            # wrangler dev (local)
pnpm deploy         # wrangler deploy (prod)
```

## License

MIT. Not affiliated with War Era.
