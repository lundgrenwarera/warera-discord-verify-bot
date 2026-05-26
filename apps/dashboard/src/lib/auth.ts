import { API_BASE, DISCORD_CLIENT_ID } from "./config";

const SESSION_KEY = "warera_verify_session";
const STATE_KEY = "warera_verify_oauth_state";

export interface SessionPayload {
  userId: string;
  username: string;
  avatar?: string;
  adminGuildIds: string[];
  exp: number;
}

export interface Session {
  token: string;
  payload: SessionPayload;
}

export function getSession(): Session | null {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as SessionPayload;
    if (payload.exp * 1000 < Date.now()) {
      clearSession();
      return null;
    }
    return { token, payload };
  } catch {
    clearSession();
    return null;
  }
}

export function setSession(token: string) {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function beginLogin() {
  const state = crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  sessionStorage.setItem(STATE_KEY, state);
  const redirectUri = `${window.location.origin}/auth/callback`;
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  window.location.href = url.toString();
}

export async function completeLogin(code: string, returnedState: string): Promise<void> {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!expected || expected !== returnedState) {
    throw new Error("oauth state mismatch");
  }
  const redirectUri = `${window.location.origin}/auth/callback`;
  const r = await fetch(`${API_BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri }),
  });
  if (!r.ok) throw new Error(`auth failed (${r.status})`);
  const { token } = await r.json() as { token: string };
  setSession(token);
}
