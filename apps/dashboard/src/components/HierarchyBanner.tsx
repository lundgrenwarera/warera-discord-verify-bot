import { useEffect, useState } from "react";
import { api, type HierarchyCheck } from "../lib/api";

export function HierarchyBanner({ guildId }: { guildId: string }) {
  const [check, setCheck] = useState<HierarchyCheck | null>(null);

  useEffect(() => {
    api.guildHierarchy(guildId).then(setCheck).catch(() => setCheck(null));
  }, [guildId]);

  if (!check || check.ok) return null;
  if (check.blocking.length === 0) return null;

  return (
    <div className="tactical-panel rounded-sm p-4 sm:p-5 mb-4 border-warn">
      <div className="label text-warn">⚠ Role hierarchy</div>
      <p className="mt-2 text-sm text-text">
        The bot can't assign these roles because they sit at or above its own role:
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {check.blocking.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1.5 rounded border border-warn bg-warn/10 px-2 py-0.5 font-mono text-[11px] text-warn">
            @{r.name}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Fix it in Discord: <strong className="text-text">Server Settings → Roles</strong>, then drag the <strong className="text-text">WarEra</strong> role <em>above</em> each of the roles above. The bot can only manage roles below its own.
      </p>
    </div>
  );
}
