"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useHasMounted } from "@/lib/hooks";
import { usePresenceCount } from "@/lib/supabase/use-presence";

const AVATARS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];

export function FocusingTogether() {
  const mounted = useHasMounted();
  const live = usePresenceCount("global");

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Focusing together</h3>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex size-2">
            <span className="live-dot absolute inline-flex size-full rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          live
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {AVATARS.map((c, i) => (
            <span
              key={i}
              className="size-8 rounded-full border-2 border-card"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {mounted ? live : "—"}
          </span>{" "}
          people in deep work right now.
        </p>
      </div>
      <Link
        href="/rooms"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border bg-secondary/50 py-2 text-sm font-medium transition-colors hover:bg-secondary"
      >
        Join a study room <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
