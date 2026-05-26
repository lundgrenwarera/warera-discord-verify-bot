const API = "https://discord.com/api/v10";

export async function verifySignature(
  publicKeyHex: string,
  body: string,
  signature: string | null,
  timestamp: string | null,
): Promise<boolean> {
  if (!signature || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKeyHex),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export interface FollowupOptions {
  appId: string;
  interactionToken: string;
  content: string;
  ephemeral?: boolean;
  components?: unknown[];
}

export async function sendFollowup(opts: FollowupOptions): Promise<void> {
  const url = `${API}/webhooks/${opts.appId}/${opts.interactionToken}`;
  const body: Record<string, unknown> = { content: opts.content };
  if (opts.ephemeral) body.flags = 64;
  if (opts.components) body.components = opts.components;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface EditOriginalOptions {
  appId: string;
  interactionToken: string;
  content: string;
  components?: unknown[];
}

export async function editOriginalResponse(opts: EditOriginalOptions): Promise<void> {
  const url = `${API}/webhooks/${opts.appId}/${opts.interactionToken}/messages/@original`;
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: opts.content,
      components: opts.components ?? [],
    }),
  });
}

export async function addRoleToMember(args: {
  botToken: string;
  guildId: string;
  userId: string;
  roleId: string;
}): Promise<{ ok: boolean; status: number; body?: string }> {
  const r = await fetch(
    `${API}/guilds/${args.guildId}/members/${args.userId}/roles/${args.roleId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${args.botToken}`,
        "X-Audit-Log-Reason": "Verified via War Era token",
      },
    },
  );
  if (r.ok) return { ok: true, status: r.status };
  return { ok: false, status: r.status, body: await r.text() };
}

export async function sendChannelMessage(args: {
  botToken: string;
  channelId: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; status: number; body?: string }> {
  const r = await fetch(`${API}/channels/${args.channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${args.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args.payload),
  });
  if (r.ok) return { ok: true, status: r.status };
  return { ok: false, status: r.status, body: await r.text() };
}
