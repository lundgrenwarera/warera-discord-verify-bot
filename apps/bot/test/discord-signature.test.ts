import { describe, it, expect, beforeAll } from "vitest";
import { verifySignature } from "../src/lib/discord";

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

let publicKeyHex: string;
let privateKey: CryptoKey;

beforeAll(async () => {
  // Generate a fresh Ed25519 keypair for the test run, then export the public
  // key in hex (the format the worker reads from DISCORD_PUBLIC_KEY).
  const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]) as CryptoKeyPair;
  privateKey = pair.privateKey;
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  publicKeyHex = bytesToHex(new Uint8Array(raw));
});

async function sign(message: string): Promise<string> {
  const sig = await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

describe("verifySignature", () => {
  it("accepts a valid signature over timestamp+body", async () => {
    const timestamp = "1700000000";
    const body = '{"type":1}';
    const signature = await sign(timestamp + body);
    expect(await verifySignature(publicKeyHex, body, signature, timestamp)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const timestamp = "1700000000";
    const body = '{"type":1}';
    const signature = await sign(timestamp + body);
    const tampered = '{"type":2}';
    expect(await verifySignature(publicKeyHex, tampered, signature, timestamp)).toBe(false);
  });

  it("rejects a stale timestamp (replay attempt)", async () => {
    const timestamp = "1700000000";
    const body = '{"type":1}';
    const signature = await sign(timestamp + body);
    expect(await verifySignature(publicKeyHex, body, signature, "1700000001")).toBe(false);
  });

  it("rejects null signature or timestamp", async () => {
    expect(await verifySignature(publicKeyHex, "body", null, "123")).toBe(false);
    expect(await verifySignature(publicKeyHex, "body", "deadbeef", null)).toBe(false);
  });

  it("rejects garbage hex without throwing", async () => {
    expect(await verifySignature(publicKeyHex, "body", "notvalidhex", "123")).toBe(false);
  });
});
