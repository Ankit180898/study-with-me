"use client";

import { useState } from "react";
import { Mail, Check, CloudOff, RefreshCw, LogOut } from "lucide-react";
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
import { useSupabase } from "@/lib/supabase/provider";
import { useUiStore } from "@/store/ui-store";

export function AuthDialog() {
  const { supabase, user } = useSupabase();
  const open = useUiStore((s) => s.authOpen);
  const mode = useUiStore((s) => s.authMode);
  const closeAuth = useUiStore((s) => s.closeAuth);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentAs, setSentAs] = useState<"sync" | "signin">("sync");
  const [error, setError] = useState<string | null>(null);

  const isSynced = Boolean(user?.email);
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;

  function reset() {
    setEmail("");
    setBusy(false);
    setSent(false);
    setError(null);
  }

  function onOpenChange(next: boolean) {
    if (!next) {
      closeAuth();
      reset();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    setBusy(true);
    setError(null);
    const trimmed = email.trim();
    try {
      if (mode === "sync") {
        // Try to attach this email to the current (anonymous) account first.
        const { error } = await supabase.auth.updateUser(
          { email: trimmed },
          { emailRedirectTo: redirectTo },
        );
        if (error) {
          // If the email already belongs to another account, fall back to
          // sign-in so the user lands on the existing account instead of
          // hitting "email already in use" and being stuck. Local sessions
          // from this device get auto-uploaded to the signed-in account by
          // the provider's sync effect.
          const msg = error.message.toLowerCase();
          const looksTaken =
            msg.includes("already") ||
            msg.includes("exists") ||
            msg.includes("registered");
          if (!looksTaken) throw error;
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: trimmed,
            options: { emailRedirectTo: redirectTo },
          });
          if (otpError) throw otpError;
          setSentAs("signin");
        } else {
          setSentAs("sync");
        }
      } else {
        // explicit sign-in path
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setSentAs("signin");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    // start fresh as a new guest, then reload so all state re-syncs cleanly
    window.location.reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {isSynced ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="size-5 text-emerald-500" /> Synced
              </DialogTitle>
              <DialogDescription>
                Your progress is saved to your account and available on any device.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Signed in as </span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut /> Sign out
            </Button>
          </>
        ) : sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="size-5 text-primary" /> Check your inbox
              </DialogTitle>
              <DialogDescription>
                We sent a magic link to{" "}
                <span className="font-medium text-foreground">{email}</span>.{" "}
                {sentAs === "signin" ? (
                  <>
                    This email is already linked to an account — click the link
                    to sign in to it. Anything you did on this device will be
                    merged in.
                  </>
                ) : (
                  <>Click it to finish syncing — your current progress stays intact.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" onClick={() => setSent(false)}>
              <RefreshCw /> Use a different email
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {mode === "sync" ? (
                  <>
                    <CloudOff className="size-5 text-primary" /> Sync your progress
                  </>
                ) : (
                  <>
                    <Mail className="size-5 text-primary" /> Sign in
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {mode === "sync"
                  ? "You're studying as a guest. Add your email to save your streak and sessions across devices — no password needed."
                  : "Enter your email and we'll send you a magic link to sign in."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send magic link"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              {mode === "sync" ? (
                <>
                  Already have an account?{" "}
                  <button
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                    onClick={() => useUiStore.getState().openAuth("signin")}
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New here?{" "}
                  <button
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                    onClick={() => useUiStore.getState().openAuth("sync")}
                  >
                    Sync this guest account
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
