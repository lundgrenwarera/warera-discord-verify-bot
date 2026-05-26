export type RoleMap<K extends string = string> = { [P in K]?: string[] };

export function addToRoleMap<K extends string>(
  map: RoleMap<K> | undefined,
  key: K,
  roleId: string,
): RoleMap<K> {
  const next: RoleMap<K> = { ...(map ?? {}) };
  const existing = new Set(next[key] ?? []);
  existing.add(roleId);
  next[key] = Array.from(existing);
  return next;
}

export function removeFromRoleMap<K extends string>(
  map: RoleMap<K> | undefined,
  key: K,
  roleId: string,
): RoleMap<K> {
  const next: RoleMap<K> = { ...(map ?? {}) };
  const remaining = (next[key] ?? []).filter((id: string) => id !== roleId);
  if (remaining.length > 0) {
    next[key] = remaining;
  } else {
    delete next[key];
  }
  return next;
}

export function isRoleMapEmpty<K extends string>(map: RoleMap<K> | undefined): boolean {
  if (!map) return true;
  return Object.keys(map).length === 0;
}
