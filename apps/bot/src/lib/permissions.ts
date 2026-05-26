const ADMINISTRATOR = 0x8n;

export function isAdmin(permissions: bigint): boolean {
  return (permissions & ADMINISTRATOR) !== 0n;
}

export function parsePermissions(raw: string | number | bigint | undefined | null): bigint {
  if (raw == null) return 0n;
  if (typeof raw === "bigint") return raw;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}
