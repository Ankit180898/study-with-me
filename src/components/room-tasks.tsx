"use client";

import { useState } from "react";
import { CheckSquare, Circle, CheckCircle2, X, Trash2, ListTodo } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomTasks, type RoomTask } from "@/lib/use-room-tasks";
import { useSupabase } from "@/lib/supabase/provider";
import { cn } from "@/lib/utils";

function TaskRow({
  task,
  isMine,
  onToggle,
  onRemove,
}: {
  task: RoomTask;
  isMine: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        "group flex items-start gap-3 rounded-lg border bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/30",
        task.done && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        title={task.done ? "Mark as not done" : "Mark complete"}
        className={cn(
          "mt-0.5 shrink-0 transition-colors",
          task.done
            ? "text-chart-3 hover:text-chart-3/80"
            : "text-muted-foreground hover:text-primary",
        )}
      >
        {task.done ? (
          <CheckCircle2 className="size-5" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "break-words text-sm leading-snug",
            task.done && "line-through text-muted-foreground",
          )}
        >
          {task.text}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {task.done && task.completedByName ? (
            <>
              ✓ done by {task.completedByName} · added by{" "}
              {isMine ? "you" : task.createdByName}
            </>
          ) : (
            <>added by {isMine ? "you" : task.createdByName}</>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        title="Remove task"
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

export function RoomTasks({ roomId }: { roomId: string }) {
  const { userId } = useSupabase();
  const { tasks, addTask, toggleTask, removeTask, clearCompleted } =
    useRoomTasks(roomId);
  const [input, setInput] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    void addTask(text);
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <CheckSquare className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Group tasks</h2>
          <p className="text-xs text-muted-foreground">
            Shared with everyone in this room. Anyone can add or check off.
          </p>
        </div>
        {done.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void clearCompleted()}
            title="Remove all completed tasks"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Clear done</span>
          </Button>
        )}
      </div>

      <Card className="p-3">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a task — e.g. Finish chapter 3 problem set"
            maxLength={140}
            className="bg-background"
          />
          <Button type="submit" disabled={!input.trim()}>
            Add
          </Button>
        </form>
      </Card>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <ListTodo className="size-10 opacity-40" />
            <p className="text-sm">No tasks yet — add the first one above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {open.length > 0 && (
              <section>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  To do · {open.length}
                </p>
                <ul className="space-y-1.5">
                  {open.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      isMine={t.createdBy === userId}
                      onToggle={() => void toggleTask(t.id)}
                      onRemove={() => void removeTask(t.id)}
                    />
                  ))}
                </ul>
              </section>
            )}
            {done.length > 0 && (
              <section>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Done · {done.length}
                </p>
                <ul className="space-y-1.5">
                  {done.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      isMine={t.createdBy === userId}
                      onToggle={() => void toggleTask(t.id)}
                      onRemove={() => void removeTask(t.id)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
