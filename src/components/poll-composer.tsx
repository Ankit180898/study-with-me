"use client";

import { useState } from "react";
import { BarChart3, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PRESETS: { question: string; options: string[] }[] = [
  { question: "Take a 5-min break?", options: ["Yes 🙌", "Keep going 💪"] },
  { question: "Next focus block length?", options: ["25 min", "50 min", "Free"] },
  { question: "Vibe check 🌙", options: ["Locked in 🔒", "Distracted 🌀", "Tired 😴"] },
];

export function PollComposer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
}) {
  const [question, setQuestion] = useState("");
  const [opts, setOpts] = useState<string[]>(["", ""]);

  if (!open) return null;

  function reset() {
    setQuestion("");
    setOpts(["", ""]);
  }

  function submit() {
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || clean.length < 2) return;
    onCreate(question.trim(), clean);
    reset();
    onClose();
  }

  function usePreset(p: (typeof PRESETS)[number]) {
    setQuestion(p.question);
    setOpts([...p.options, ...Array(Math.max(0, 2 - p.options.length)).fill("")]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Create a poll</h3>
          <button
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Question
            </label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={140}
              autoFocus
              placeholder="e.g. Take a 5-min break?"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Options
            </label>
            <div className="space-y-2">
              {opts.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) =>
                      setOpts((arr) => arr.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    maxLength={60}
                    placeholder={`Option ${i + 1}`}
                  />
                  {opts.length > 2 && (
                    <button
                      onClick={() => setOpts((arr) => arr.filter((_, j) => j !== i))}
                      title="Remove"
                      className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {opts.length < 4 && (
              <button
                onClick={() => setOpts((arr) => [...arr, ""])}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
              >
                <Plus className="size-3.5" /> Add option
              </button>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Quick presets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.question}
                  onClick={() => usePreset(p)}
                  className="rounded-full border bg-secondary/40 px-2.5 py-1 text-[11px] hover:bg-secondary"
                >
                  {p.question}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit}>
            Post poll
          </Button>
        </div>
      </div>
    </div>
  );
}
