"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Users,
  Clock,
  ArrowDown,
  SmilePlus,
  MessageSquare,
  Timer as TimerIcon,
  Video,
  LogOut,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimerCard } from "@/components/timer-card";
import { VideoRoom } from "@/components/video-room";
import { RoomNav } from "@/components/room-nav";
import { RoomMembersPanel } from "@/components/room-members-panel";
import {
  useRoom,
  type RoomMember,
  type ChatEntry,
  type ChatMessage,
} from "@/lib/use-room";
import { useJukeboxStore } from "@/lib/jukebox-store";
import { usePolls, type Poll } from "@/lib/use-polls";
import { PollCard } from "@/components/poll-card";
import { PollComposer } from "@/components/poll-composer";
import { initialsFor } from "@/lib/identity";
import { getRoom } from "@/lib/rooms";
import { formatMinutes } from "@/lib/time";
import { useNow } from "@/lib/hooks";
import { elapsedMs, targetMsFor } from "@/store/focus-store";
import { useProfile } from "@/lib/use-profile";
import { cn } from "@/lib/utils";

const FREE_BLOCK = 25 * 60_000;
const CLUSTER_GAP_MS = 4 * 60_000;
const CELEBRATE_MS = 5_000;
const REACTION_EMOJI = ["👍", "❤️", "🎉", "🔥", "😂", "👀"] as const;

// ─────────────────────── Avatar ───────────────────────

function Avatar({
  name,
  color,
  size = 32,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-background"
      style={{ backgroundColor: color, width: size, height: size }}
      title={name}
    >
      {initialsFor(name)}
    </span>
  );
}

// ─────────────────────── Member status ───────────────────────

interface MemberStatus {
  label: string;
  tone: string;
  active: boolean;
  celebrating: boolean;
}

function statusOf(m: RoomMember, now: number): MemberStatus {
  if (m.status === "running") {
    if (m.mode === "focus" || m.mode === "free")
      return {
        label: "Focusing",
        tone: "var(--chart-3)",
        active: true,
        celebrating: false,
      };
    return {
      label: "On a break",
      tone: "var(--chart-4)",
      active: true,
      celebrating: false,
    };
  }
  if (m.lastCompletedAt && now - m.lastCompletedAt < CELEBRATE_MS)
    return {
      label: "Just completed!",
      tone: "var(--chart-3)",
      active: true,
      celebrating: true,
    };
  return {
    label: m.status === "paused" ? "Paused" : "Idle",
    tone: "var(--muted-foreground)",
    active: false,
    celebrating: false,
  };
}

// ─────────────────────── MiniRing ───────────────────────

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
  const { tone, active } = stat;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
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
        <Avatar name={member.name} color={member.color} size={size - 10} />
      </div>
    </div>
  );
}

// ─────────────────────── WorkingOnLine ───────────────────────

function WorkingOnLine({
  member,
  isMe,
}: {
  member: RoomMember;
  isMe: boolean;
}) {
  const { saveWorkingOn } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.workingOn);

  useEffect(() => {
    if (!editing) setDraft(member.workingOn);
  }, [member.workingOn, editing]);

  if (!isMe)
    return member.workingOn ? (
      <p className="truncate text-xs text-muted-foreground">
        📝 {member.workingOn}
      </p>
    ) : null;

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
      {member.workingOn ? (
        `📝 ${member.workingOn}`
      ) : (
        <span className="opacity-50">+ what are you working on?</span>
      )}
    </button>
  );
}

// ─────────────────────── StudyHall ───────────────────────

function StudyHall({
  members,
  meId,
}: {
  members: RoomMember[];
  meId: string | null;
}) {
  const now = useNow(1000);
  const focusing = members.filter((m) => {
    const s = statusOf(m, now);
    return (
      s.active && !s.celebrating && (m.mode === "focus" || m.mode === "free")
    );
  }).length;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Study hall
        </h3>
        <span className="rounded-full bg-chart-3/15 px-2.5 py-0.5 text-xs font-medium text-chart-3 tabular-nums">
          {focusing} focusing
        </span>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Connecting…</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const { label, tone } = statusOf(m, now);
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/40"
              >
                <MiniRing member={m} now={now} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.id === meId && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-medium" style={{ color: tone }}>
                    {label}
                  </p>
                  <WorkingOnLine member={m} isMe={m.id === meId} />
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatMinutes(m.todayMs)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────── Chat helpers ───────────────────────

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
interface CelebrateBlock {
  kind: "celebrate";
  id: string;
  userId: string;
  name: string;
  color: string;
  durationMs: number;
  at: number;
}
interface PollBlock {
  kind: "poll";
  id: string;
  poll: Poll;
  at: number;
}
type Block = MessageGroup | SystemBlock | CelebrateBlock | PollBlock;

function timeOfBlock(b: Block): number {
  if (b.kind === "system" || b.kind === "celebrate" || b.kind === "poll") return b.at;
  return b.messages[0].at;
}

function mergePolls(blocks: Block[], polls: Poll[]): Block[] {
  const pollBlocks: PollBlock[] = polls.map((p) => ({
    kind: "poll",
    id: p.id,
    poll: p,
    at: p.createdAt,
  }));
  return [...blocks, ...pollBlocks].sort((a, b) => timeOfBlock(a) - timeOfBlock(b));
}

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
        text: e.kind === "join" ? `${e.name} joined` : `${e.name} left`,
        at: e.at,
      });
      continue;
    }
    if (e.type === "celebrate") {
      if (current) {
        blocks.push(current);
        current = null;
      }
      blocks.push({
        kind: "celebrate",
        id: e.id,
        userId: e.userId,
        name: e.name,
        color: e.color,
        durationMs: e.durationMs,
        at: e.at,
      });
      continue;
    }
    const last = current?.messages.at(-1);
    if (
      current &&
      last &&
      current.userId === e.userId &&
      e.at - last.at < CLUSTER_GAP_MS
    ) {
      current.messages.push(e);
    } else {
      if (current) blocks.push(current);
      current = {
        kind: "group",
        userId: e.userId,
        name: e.name,
        color: e.color,
        messages: [e],
      };
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

// ─────────────────────── ReactionRow ───────────────────────

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

// ─────────────────────── MessageBubble ───────────────────────

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
          "rounded-2xl px-3 py-1.5 text-sm leading-relaxed",
          mine ? "bg-primary text-primary-foreground" : "bg-muted/70",
        )}
      >
        <Linkify text={message.text} />
      </div>
      <ReactionRow reactions={reactions} meId={meId} onToggle={onReact} />
      <div
        className={cn(
          "absolute -top-9 z-10 flex items-center gap-0.5 rounded-full border bg-card/95 px-1 py-1 shadow-lg backdrop-blur",
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
        <button className="ml-0.5 flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
          <SmilePlus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────── CelebrateBlockView ───────────────────────

function CelebrateBlockView({
  block,
  mine,
  reactions,
  meId,
  onReact,
}: {
  block: CelebrateBlock;
  mine: boolean;
  reactions: Record<string, string[]>;
  meId: string | null;
  onReact: (emoji: string) => void;
}) {
  return (
    <div className="self-center w-full max-w-[85%]">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
        <span className="text-xl">🎉</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="font-semibold" style={{ color: block.color }}>
              {mine ? "You" : block.name}
            </span>{" "}
            just finished a{" "}
            <span className="font-medium">
              {formatMinutes(block.durationMs)}
            </span>{" "}
            focus block
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {(["👏", "🔥", "🎉"] as const).map((emoji) => {
            const mineReacted = meId && reactions[emoji]?.includes(meId);
            return (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={cn(
                  "flex items-center gap-0.5 rounded-full px-2 py-1 text-xs transition-colors",
                  mineReacted ? "bg-emerald-500/25" : "hover:bg-emerald-500/15",
                )}
              >
                <span className="text-base leading-none">{emoji}</span>
                {(reactions[emoji]?.length ?? 0) > 0 && (
                  <span className="tabular-nums">
                    {reactions[emoji].length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── MessageCluster ───────────────────────

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
  return (
    <div className={cn("flex w-full gap-2.5", mine ? "flex-row-reverse" : "")}>
      <Avatar name={group.name} color={group.color} size={30} />
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-1",
          mine ? "items-end" : "items-start",
        )}
      >
        <span className="text-xs text-muted-foreground">
          {mine ? "You" : group.name} · {fmt.format(group.messages[0].at)}
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

// ─────────────────────── Chat ───────────────────────

function Chat({
  entries,
  reactions,
  meId,
  typing,
  onSend,
  onType,
  onReact,
  polls,
  pollCounts,
  pollVotes,
  onVote,
  onCreatePoll,
}: {
  entries: ChatEntry[];
  reactions: Record<string, Record<string, string[]>>;
  meId: string | null;
  typing: { id: string; name: string }[];
  onSend: (text: string) => void;
  onType: () => void;
  onReact: (messageId: string, emoji: string) => void;
  polls: Poll[];
  pollCounts: Record<string, number[]>;
  pollVotes: Record<string, Record<string, number>>;
  onVote: (pollId: string, optionIndex: number) => void;
  onCreatePoll: (question: string, options: string[]) => void;
}) {
  const blocks = useMemo(
    () => mergePolls(buildBlocks(entries), polls),
    [entries, polls],
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevCount = useRef(entries.length);
  const fmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  function scrollToBottom(smooth = true) {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
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
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {" "}
      {/* scroll area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {blocks.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            No messages yet — say hi 👋
          </div>
        )}
        <div className="flex flex-col gap-4">
          {blocks.map((b) => {
            if (b.kind === "system")
              return (
                <div
                  key={b.id}
                  className="self-center text-xs text-muted-foreground"
                >
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px]">
                    — {b.text} —
                  </span>
                </div>
              );
            if (b.kind === "celebrate")
              return (
                <CelebrateBlockView
                  key={b.id}
                  block={b}
                  mine={b.userId === meId}
                  reactions={reactions[b.id] ?? {}}
                  meId={meId}
                  onReact={(emoji) => onReact(b.id, emoji)}
                />
              );
            if (b.kind === "poll") {
              const myVote =
                meId && pollVotes[b.poll.id]?.[meId] !== undefined
                  ? pollVotes[b.poll.id][meId]
                  : null;
              return (
                <PollCard
                  key={b.id}
                  poll={b.poll}
                  counts={pollCounts[b.poll.id] ?? []}
                  myVote={myVote}
                  onVote={(idx) => onVote(b.poll.id, idx)}
                />
              );
            }
            return (
              <MessageCluster
                key={b.messages[0].id}
                group={b}
                mine={b.userId === meId}
                reactions={reactions}
                meId={meId}
                onReact={onReact}
                fmt={fmt}
              />
            );
          })}
        </div>
      </div>
      {/* jump to bottom */}
      <div className="relative">
        {!atBottom && newCount > 0 && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute -top-10 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md"
          >
            <ArrowDown className="size-3.5" /> {newCount} new{" "}
            {newCount === 1 ? "message" : "messages"}
          </button>
        )}
        <div className="h-5 px-4 text-xs text-muted-foreground">
          {typingLabel && <span className="animate-pulse">{typingLabel}</span>}
        </div>
      </div>
      {/* input */}
      <form onSubmit={submit} className="flex gap-2 border-t px-3 py-3">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          title="Create poll"
          onClick={() => setComposerOpen(true)}
          className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
        >
          <BarChart3 className="size-4" />
        </Button>
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onType();
          }}
          placeholder="Message the room…"
          maxLength={400}
          className="rounded-xl bg-muted/50 text-sm focus-visible:ring-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim()}
          className="shrink-0 rounded-xl"
        >
          <Send className="size-4" />
        </Button>
      </form>
      <PollComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreate={onCreatePoll}
      />
    </div>
  );
}

// ─────────────────────── Tab system (always-mounted) ───────────────────────

type TabId = "chat" | "video" | "timer";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "chat", label: "Chat", icon: <MessageSquare className="size-3.5" /> },
  { id: "video", label: "Video", icon: <Video className="size-3.5" /> },
  { id: "timer", label: "Timer", icon: <TimerIcon className="size-3.5" /> },
];

// ─────────────────────── RoomView ───────────────────────

export function RoomView({ roomId }: { roomId: string }) {
  const room = getRoom(roomId);
  const {
    members,
    entries,
    reactions,
    typing,
    sendMessage,
    sendTyping,
    toggleReaction,
    me,
  } = useRoom(roomId);
  const { polls, counts: pollCounts, votes: pollVotes, createPoll, vote: votePoll } =
    usePolls(roomId);
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const router = useRouter();
  const joinJukebox = useJukeboxStore((s) => s.join);
  const leaveJukebox = useJukeboxStore((s) => s.leave);
  useEffect(() => {
    joinJukebox(roomId);
  }, [roomId, joinJukebox]);

  function leaveRoom() {
    leaveJukebox();
    router.push("/rooms");
  }

  if (!room) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center">
        <p className="text-muted-foreground">That room doesn&apos;t exist.</p>
        <Link
          href="/rooms"
          className="mt-2 inline-block text-sm font-medium underline-offset-2 hover:underline"
        >
          Back to all rooms
        </Link>
      </div>
    );
  }

  const Icon = room.icon;
  const togetherMs = members.reduce((sum, m) => sum + m.todayMs, 0);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Left rail: rooms list + now-playing footer (hidden in video mode for full-bleed canvas) ── */}
      {activeTab !== "video" && (
        <RoomNav currentRoomId={roomId} currentRoomCount={members.length} />
      )}

      {/* ── Center column ── */}
      <div className="flex flex-1 min-w-0 min-h-0 flex-col">
        {/* room header */}
        <div className="flex shrink-0 items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
          <Link
            href="/rooms"
            className="text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            title="All rooms"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in oklch, ${room.accent} 18%, transparent)` }}
          >
            <Icon className="size-4" style={{ color: room.accent }} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight">{room.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {members.length} studying
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {formatMinutes(togetherMs)} together today
              </span>
              <span className="hidden text-muted-foreground/60 sm:inline">· {room.vibe}</span>
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={leaveRoom}
            title="Leave room — stops music and returns to all rooms"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>

        {/* tabs */}
        <div className="flex shrink-0 gap-1 border-b bg-muted/20 px-2 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                activeTab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className={cn("h-full min-h-0 flex flex-col", activeTab !== "chat" && "hidden")}>
            <Chat
              entries={entries}
              reactions={reactions}
              meId={me.id}
              typing={typing}
              onSend={sendMessage}
              onType={sendTyping}
              onReact={toggleReaction}
              polls={polls}
              pollCounts={pollCounts}
              pollVotes={pollVotes}
              onVote={votePoll}
              onCreatePoll={createPoll}
            />
          </div>

          <div className={cn("h-full min-h-0", activeTab !== "video" && "hidden")}>
            <VideoRoom roomId={roomId} className="h-full min-h-0" />
          </div>

          <div className={cn("h-full min-h-0 overflow-y-auto p-4", activeTab !== "timer" && "hidden")}>
            <TimerCard />
          </div>
        </div>
      </div>

      {/* ── Right rail: members (hidden in video mode so the call goes edge-to-edge) ── */}
      {activeTab !== "video" && (
        <RoomMembersPanel members={members} meId={me.id} />
      )}
    </div>
  );
}
