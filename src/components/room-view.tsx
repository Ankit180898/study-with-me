"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Users, Clock, ArrowDown, SmilePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimerCard } from "@/components/timer-card";
import { RoomMusic } from "@/components/room-music";
import { useRoom, type RoomMember, type ChatEntry, type ChatMessage } from "@/lib/use-room";
import { initialsFor } from "@/lib/identity";
import { getRoom } from "@/lib/rooms";
import { formatMinutes } from "@/lib/time";
import { useNow } from "@/lib/hooks";
import { elapsedMs, targetMsFor } from "@/store/focus-store";
import { cn } from "@/lib/utils";

const FREE_BLOCK = 25 * 60_000;
const CLUSTER_GAP_MS = 4 * 60_000;
const REACTION_EMOJI = ["👍", "❤️", "🎉", "🔥", "😂", "👀"] as const;

// ─────────────────────── shared bits ───────────────────────

function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color, width: size, height: size }}
      title={name}
    >
      {initialsFor(name)}
    </span>
  );
}

function statusOf(m: RoomMember): { label: string; tone: string; active: boolean } {
  if (m.status !== "running")
    return { label: m.status === "paused" ? "Paused" : "Idle", tone: "var(--muted-foreground)", active: false };
  if (m.mode === "focus" || m.mode === "free")
    return { label: "Focusing", tone: "var(--chart-3)", active: true };
  return { label: "On a break", tone: "var(--chart-4)", active: true };
}

function MiniRing({ member, now }: { member: RoomMember; now: number }) {
  const size = 38;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = targetMsFor(member.mode);
  const elapsed = elapsedMs(member, now);
  const progress =
    member.mode === "free"
      ? member.status === "running"
        ? (elapsed % FREE_BLOCK) / FREE_BLOCK
        : 0
      : target === 0
        ? 0
        : Math.min(1, elapsed / target);
  const { tone, active } = statusOf(member);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
        {active && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Avatar name={member.name} color={member.color} size={size - 12} />
      </div>
    </div>
  );
}

function StudyHall({ members, meId }: { members: RoomMember[]; meId: string | null }) {
  const now = useNow(1000);
  const focusing = members.filter((m) => statusOf(m).active && (m.mode === "focus" || m.mode === "free")).length;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Study hall</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{focusing} focusing</span>
      </div>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Connecting…</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const { label, tone } = statusOf(m);
            return (
              <li key={m.id} className="flex items-center gap-3">
                <MiniRing member={m} now={now} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.id === meId && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-xs" style={{ color: tone }}>
                    {label}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{formatMinutes(m.todayMs)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ─────────────────────── chat ───────────────────────

const URL_RE = /(\bhttps?:\/\/[^\s]+)/g;

function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        URL_RE.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

interface MessageGroup {
  kind: "group";
  userId: string;
  name: string;
  color: string;
  messages: ChatMessage[];
}
interface SystemBlock {
  kind: "system";
  id: string;
  text: string;
  at: number;
}
type Block = MessageGroup | SystemBlock;

function buildBlocks(entries: ChatEntry[]): Block[] {
  const blocks: Block[] = [];
  let current: MessageGroup | null = null;
  for (const e of entries) {
    if (e.type === "system") {
      if (current) {
        blocks.push(current);
        current = null;
      }
      blocks.push({
        kind: "system",
        id: e.id,
        text: e.kind === "join" ? `${e.name} joined the room` : `${e.name} left`,
        at: e.at,
      });
      continue;
    }
    const last = current?.messages.at(-1);
    if (current && last && current.userId === e.userId && e.at - last.at < CLUSTER_GAP_MS) {
      current.messages.push(e);
    } else {
      if (current) blocks.push(current);
      current = { kind: "group", userId: e.userId, name: e.name, color: e.color, messages: [e] };
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function ReactionRow({
  reactions,
  meId,
  onToggle,
}: {
  reactions: Record<string, string[]>;
  meId: string | null;
  onToggle: (emoji: string) => void;
}) {
  const entries = Object.entries(reactions);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([emoji, users]) => {
        const mine = meId && users.includes(meId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
              mine
                ? "border-primary/40 bg-primary/15 text-foreground"
                : "border-border bg-secondary/60 hover:bg-secondary",
            )}
          >
            <span>{emoji}</span>
            <span className="tabular-nums">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  reactions,
  meId,
  onReact,
}: {
  message: ChatMessage;
  mine: boolean;
  reactions: Record<string, string[]>;
  meId: string | null;
  onReact: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("group relative", mine ? "self-end" : "self-start")}>
      <div
        className={cn(
          "rounded-2xl px-3 py-1.5 text-sm",
          mine ? "bg-primary text-primary-foreground" : "bg-secondary",
        )}
      >
        <Linkify text={message.text} />
      </div>
      <ReactionRow reactions={reactions} meId={meId} onToggle={onReact} />

      {/* reaction picker — appears on hover */}
      <div
        className={cn(
          "absolute -top-9 z-10 flex items-center gap-0.5 rounded-full border bg-card/95 px-1 py-1 shadow-md backdrop-blur",
          "opacity-0 transition-opacity group-hover:opacity-100",
          mine ? "right-0" : "left-0",
          open && "opacity-100",
        )}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {REACTION_EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="rounded-full px-1 text-base leading-none transition-transform hover:scale-125"
            aria-label={`react ${e}`}
          >
            {e}
          </button>
        ))}
        <button
          className="ml-0.5 flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label="more reactions"
        >
          <SmilePlus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Chat({
  entries,
  reactions,
  meId,
  typing,
  onSend,
  onType,
  onReact,
}: {
  entries: ChatEntry[];
  reactions: Record<string, Record<string, string[]>>;
  meId: string | null;
  typing: { id: string; name: string }[];
  onSend: (text: string) => void;
  onType: () => void;
  onReact: (messageId: string, emoji: string) => void;
}) {
  const blocks = useMemo(() => buildBlocks(entries), [entries]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevCount = useRef(entries.length);
  const fmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  function scrollToBottom(smooth = true) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(near);
    if (near) setNewCount(0);
  }

  useEffect(() => {
    const grew = entries.length > prevCount.current;
    prevCount.current = entries.length;
    if (!grew) return;
    if (atBottom) scrollToBottom();
    else setNewCount((n) => n + 1);
  }, [entries.length, atBottom]);

  useEffect(() => {
    scrollToBottom(false);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
    requestAnimationFrame(() => scrollToBottom());
  }

  const typingLabel =
    typing.length === 0
      ? null
      : typing.length === 1
        ? `${typing[0].name} is typing…`
        : `${typing.length} people are typing…`;

  return (
    <Card className="relative flex h-full min-h-0 flex-col p-0">
      <div className="border-b px-5 py-3">
        <h3 className="font-semibold">Room chat</h3>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 py-4">
        {blocks.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            No messages yet — say hi 👋
          </div>
        )}
        <div className="flex flex-col gap-4">
          {blocks.map((b) =>
            b.kind === "system" ? (
              <div key={b.id} className="self-center text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary/60 px-2.5 py-0.5">— {b.text} —</span>
              </div>
            ) : (
              <MessageCluster
                key={b.messages[0].id}
                group={b}
                mine={b.userId === meId}
                reactions={reactions}
                meId={meId}
                onReact={onReact}
                fmt={fmt}
              />
            ),
          )}
        </div>
      </div>

      {/* typing + jump-to-bottom */}
      <div className="relative">
        {!atBottom && newCount > 0 && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute -top-10 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md"
          >
            <ArrowDown className="size-3.5" />
            {newCount} new {newCount === 1 ? "message" : "messages"}
          </button>
        )}
        <div className="h-5 px-5 text-xs text-muted-foreground">
          {typingLabel && <span className="animate-pulse">{typingLabel}</span>}
        </div>
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t p-3">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onType();
          }}
          placeholder="Message the room…"
          maxLength={400}
        />
        <Button type="submit" size="icon-lg" disabled={!text.trim()}>
          <Send />
        </Button>
      </form>
    </Card>
  );
}

function MessageCluster({
  group,
  mine,
  reactions,
  meId,
  onReact,
  fmt,
}: {
  group: MessageGroup;
  mine: boolean;
  reactions: Record<string, Record<string, string[]>>;
  meId: string | null;
  onReact: (messageId: string, emoji: string) => void;
  fmt: Intl.DateTimeFormat;
}) {
  const first = group.messages[0];
  return (
    <div className={cn("flex w-full gap-2.5", mine ? "flex-row-reverse" : "")}>
      <Avatar name={group.name} color={group.color} size={32} />
      <div className={cn("flex max-w-[78%] flex-col gap-1", mine ? "items-end" : "items-start")}>
        <span className="text-xs text-muted-foreground">
          {mine ? "You" : group.name} · {fmt.format(first.at)}
        </span>
        {group.messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={mine}
            reactions={reactions[m.id] ?? {}}
            meId={meId}
            onReact={(emoji) => onReact(m.id, emoji)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────── room view ───────────────────────

export function RoomView({ roomId }: { roomId: string }) {
  const room = getRoom(roomId);
  const { members, entries, reactions, typing, sendMessage, sendTyping, toggleReaction, me } = useRoom(roomId);

  if (!room) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center">
        <p className="text-muted-foreground">That room doesn&apos;t exist.</p>
        <Link href="/rooms" className="mt-2 inline-block text-sm font-medium underline-offset-2 hover:underline">
          Back to all rooms
        </Link>
      </div>
    );
  }

  const Icon = room.icon;
  const togetherMs = members.reduce((sum, m) => sum + m.todayMs, 0);

  return (
    <div className="flex flex-1 flex-col">
      {/* compact room header */}
      <div className="border-b bg-background/60 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          href="/rooms"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All rooms
        </Link>
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `color-mix(in oklch, ${room.accent} 20%, transparent)` }}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{room.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {members.length} studying
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {formatMinutes(togetherMs)} focused together today
              </span>
              <span className="text-muted-foreground/70">· {room.vibe}</span>
            </p>
          </div>
        </div>
      </div>

      {/* body — full height split */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:p-6">
        <Chat
          entries={entries}
          reactions={reactions}
          meId={me.id}
          typing={typing}
          onSend={sendMessage}
          onType={sendTyping}
          onReact={toggleReaction}
        />
        <div className="flex flex-col gap-4 overflow-y-auto lg:max-h-full">
          <RoomMusic roomId={roomId} />
          <StudyHall members={members} meId={me.id} />
          <TimerCard />
        </div>
      </div>
    </div>
  );
}
