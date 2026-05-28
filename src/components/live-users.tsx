"use client";

import { useHasMounted } from "@/lib/hooks";
import { usePresenceCount } from "@/lib/supabase/use-presence";

export function LiveUsers() {
  const mounted = useHasMounted();
  const count = usePresenceCount("global");

  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3.5 py-1.5 text-sm backdrop-blur">
      <span className="relative flex size-2.5">
        <span className="live-dot absolute inline-flex size-full rounded-full bg-emerald-500/60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
      </span>
      <span className="font-medium tabular-nums">{mounted ? count : "—"}</span>
      <span className="text-muted-foreground">studying now</span>
    </div>
  );
}
