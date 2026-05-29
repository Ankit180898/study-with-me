"use client";

import { useEffect, useState } from "react";
import { type RoomMember } from "@/lib/use-room";
import { useProfile } from "@/lib/use-profile";
import { initialsFor } from "@/lib/identity";
import { useNow } from "@/lib/hooks";
import { elapsedMs, targetMsFor } from "@/store/focus-store";
import { formatMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";

const FREE_BLOCK = 25 * 60_000;
const CELEBRATE_MS = 5_000;

interface MemberStatus {
  label: string;
  tone: string;
  active: boolean;
  celebrating: boolean;
}

function statusOf(m: RoomMember, now: number): MemberStatus {
  if (m.status === "running") {
    if (m.mode === "focus" || m.mode === "free")
      return { label: "Focusing", tone: "var(--chart-3)", active: true, celebrating: false };
    return { label: "On a break", tone: "var(--chart-4)", active: true, celebrating: false };
  }
  if (m.lastCompletedAt && now - m.lastCompletedAt < CELEBRATE_MS) {
    return { label: "Just completed!", tone: "var(--chart-3)", active: true, celebrating: true };
  }
  return {
    label: m.status === "paused" ? "Paused" : "Idle",
    tone: "var(--muted-foreground)",
    active: false,
    celebrating: false,
  };
}

function MiniRing({ member, now }: { member: RoomMember; now: number }) {
  const size = 40;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = targetMsFor(member.mode);
  const elapsed = elapsedMs(member, now);
  const stat = statusOf(member, now);
  const baseProgress =
    member.mode === "free"
      ? member.status === "running"
        ? (elapsed % FREE_BLOCK) / FREE_BLOCK
        : 0
      : target === 0
        ? 0
        : Math.min(1, elapsed / target);
  const progress = stat.celebrating ? 1 : baseProgress;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {stat.active && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={stat.tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="flex items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{
            backgroundColor: member.color,
            width: size - 10,
            height: size - 10,
          }}
        >
          {initialsFor(member.name)}
        </span>
      </div>
    </div>
  );
}

function WorkingOnLine({ member, isMe }: { member: RoomMember; isMe: boolean }) {
  const { saveWorkingOn } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.workingOn);

  useEffect(() => {
    if (!editing) setDraft(member.workingOn);
  }, [member.workingOn, editing]);

  if (!isMe) {
    return member.workingOn ? (
      <p className="truncate text-xs text-muted-foreground">📝 {member.workingOn}</p>
    ) : null;
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveWorkingOn(draft);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            void saveWorkingOn(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(member.workingOn);
              setEditing(false);
            }
          }}
          maxLength={60}
          placeholder="What are you working on?"
          className="w-full rounded-md border bg-background px-2 py-0.5 text-xs outline-none focus:border-ring"
        />
      </form>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="truncate text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {member.workingOn ? `📝 ${member.workingOn}` : <span className="opacity-50">+ what are you working on?</span>}
    </button>
  );
}

export function RoomMembersPanel({
  members,
  meId,
}: {
  members: RoomMember[];
  meId: string | null;
}) {
  const now = useNow(1000);
  const focusing = members.filter((m) => {
    const s = statusOf(m, now);
    return s.active && !s.celebrating && (m.mode === "focus" || m.mode === "free");
  }).length;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-l bg-card/40 lg:flex">
      <div className="border-b px-4 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            In this room
          </p>
          <span className="text-xs tabular-nums text-muted-foreground">{members.length}</span>
        </div>
        {focusing > 0 && (
          <span className="mt-1 inline-block rounded-full bg-chart-3/15 px-2 py-0.5 text-[10px] font-medium text-chart-3 tabular-nums">
            {focusing} focusing
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {members.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Connecting…</p>
        ) : (
          <ul className="space-y-0.5">
            {members.map((m) => {
              const { label, tone } = statusOf(m, now);
              const isMe = m.id === meId;
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-secondary/60",
                  )}
                >
                  <MiniRing member={m} now={now} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {m.name}
                      {isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-xs" style={{ color: tone }}>
                      {label}
                    </p>
                    <WorkingOnLine member={m} isMe={isMe} />
                  </div>
                  <span className="self-start pt-0.5 text-[10px] text-muted-foreground tabular-nums">
                    {formatMinutes(m.todayMs)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
