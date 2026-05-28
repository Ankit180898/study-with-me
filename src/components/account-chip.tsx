"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/use-profile";
import { useUiStore } from "@/store/ui-store";

export function AccountChip() {
  const { mounted, displayName, email, isSynced } = useProfile();
  const openAuth = useUiStore((s) => s.openAuth);

  const label = mounted ? displayName || "Guest" : "—";
  const initial = (displayName || "G").charAt(0).toUpperCase();

  return (
    <button
      onClick={() => openAuth("sync")}
      className="flex w-full items-center gap-2.5 rounded-lg border bg-card/50 px-3 py-2 text-left transition-colors hover:bg-secondary/60"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span
          className={cn(
            "block truncate text-xs",
            isSynced ? "text-emerald-500" : "text-muted-foreground",
          )}
        >
          {mounted ? (isSynced ? email : "Guest · tap to sync") : ""}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
