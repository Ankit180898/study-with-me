"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { ROOMS } from "@/lib/rooms";
import { RoomMusic } from "@/components/room-music";
import { usePresenceCount } from "@/lib/supabase/use-presence";
import { useHasMounted } from "@/lib/hooks";
import { cn } from "@/lib/utils";

function RoomNavItem({
  id,
  name,
  vibe,
  icon: Icon,
  accent,
  base,
  active,
  overrideCount,
}: {
  id: string;
  name: string;
  vibe: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  base: number;
  active: boolean;
  overrideCount?: number;
}) {
  const mounted = useHasMounted();
  // skip subscribing when this is the active room — useRoom owns that channel
  const subscribed = usePresenceCount(`room:${id}`, base, {
    track: false,
    enabled: !active,
  });
  const live = active ? (overrideCount ?? 0) : subscribed;

  return (
    <Link
      href={`/rooms/${id}`}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in oklch, ${accent} 22%, transparent)` }}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground/80">{vibe}</span>
      </span>
      <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
        <Users className="size-3" />
        {mounted ? live : "—"}
      </span>
    </Link>
  );
}

export function RoomNav({
  currentRoomId,
  currentRoomCount,
}: {
  currentRoomId: string;
  currentRoomCount?: number;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/40 lg:flex">
      <div className="border-b px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rooms
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {ROOMS.map((r) => (
          <RoomNavItem
            key={r.id}
            id={r.id}
            name={r.name}
            vibe={r.vibe}
            icon={r.icon}
            accent={r.accent}
            base={r.base}
            active={r.id === currentRoomId}
            overrideCount={r.id === currentRoomId ? currentRoomCount : undefined}
          />
        ))}
      </nav>

      <div className="border-t p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Now playing
        </p>
        <RoomMusic roomId={currentRoomId} />
      </div>
    </aside>
  );
}
