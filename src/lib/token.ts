const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateToken(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let body = "";
  for (let i = 0; i < length; i++) {
    body += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `WV-${body}`;
}
