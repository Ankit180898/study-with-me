"use client";

import { useState } from "react";
import { Timer, Flame, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/lib/use-profile";
import { useUiStore } from "@/store/ui-store";

const HIGHLIGHTS = [
  { icon: Timer, text: "Focus timer with Pomodoro & free modes" },
  { icon: Flame, text: "Daily streaks and focus insights" },
  { icon: Users, text: "Study alongside others in live rooms" },
];

export function OnboardingModal() {
  const { mounted, onboarded, saveName, completeOnboarding } = useProfile();
  const [name, setName] = useState("");

  const open = mounted && !onboarded;

  function finish() {
    if (name.trim()) void saveName(name);
    completeOnboarding();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && completeOnboarding()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            S
          </span>
          <DialogTitle className="text-xl">Welcome to Study with me</DialogTitle>
          <DialogDescription>
            A calm place to focus, build streaks, and study alongside others. No account
            needed to start.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <span className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                <Icon className="size-4 text-primary" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="onboard-name">What should we call you? (optional)</Label>
            <Input
              id="onboard-name"
              placeholder="e.g. Ankit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <Button type="submit" className="w-full">
            Start focusing
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Have an account?{" "}
          <button
            className="font-medium text-foreground underline-offset-2 hover:underline"
            onClick={() => {
              completeOnboarding();
              useUiStore.getState().openAuth("signin");
            }}
          >
            Sign in
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
