"use client";

import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useHasMounted } from "@/lib/hooks";
import { usePresenceCount } from "@/lib/supabase/use-presence";
import { ROOMS, type Room } from "@/lib/rooms";

function RoomCard({ room }: { room: Room }) {
  const mounted = useHasMounted();
  const live = usePresenceCount(`room:${room.id}`, room.base, { track: false });
  const Icon = room.icon;

  return (
    <Link href={`/rooms/${room.id}`} className="group block">
      <Card className="flex h-full flex-col gap-4 p-5 transition-colors group-hover:border-foreground/15">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in oklch, ${room.accent} 20%, transparent)` }}
            >
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold">{room.name}</h3>
              <p className="text-xs text-muted-foreground">{room.vibe}</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium tabular-nums">
            <Users className="size-3.5" />
            {mounted ? live : "—"}
          </span>
        </div>

        <span className="mt-auto flex items-center justify-end gap-1.5 text-sm font-medium text-primary">
          Enter room
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Card>
    </Link>
  );
}

export function RoomsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ROOMS.map((r) => (
        <RoomCard key={r.id} room={r} />
      ))}
    </div>
  );
}
