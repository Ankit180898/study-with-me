"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHasMounted } from "@/lib/hooks";
import { useFocusStore, currentStreak } from "@/store/focus-store";
import { usePresenceCount } from "@/lib/supabase/use-presence";
import { AccountChip } from "@/components/account-chip";
import { AuthDialog } from "@/components/auth-dialog";
import { OnboardingModal } from "@/components/onboarding-modal";

const NAV = [
  { href: "/", label: "Focus", icon: Timer },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/rooms", label: "Live rooms", icon: Users },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        S
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Study with me</span>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 lg:flex-col">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const mounted = useHasMounted();
  const sessions = useFocusStore((s) => s.sessions);
  const streak = mounted ? currentStreak(sessions) : 0;
  const live = usePresenceCount("global");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="relative flex size-2.5">
            <span className="live-dot absolute inline-flex size-full rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Studying now
        </span>
        <span className="font-semibold tabular-nums">{mounted ? live : "—"}</span>
      </div>
      <div className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">🔥 Streak</span>
        <span className="font-semibold tabular-nums">
          {streak} {streak === 1 ? "day" : "days"}
        </span>
      </div>
      <AccountChip />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-1">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r bg-sidebar/60 p-4 backdrop-blur lg:flex">
        <div className="space-y-6">
          <Logo />
          <NavItems />
        </div>
        <SidebarFooter />
      </aside>

      {/* mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <div className="w-40">
            <AccountChip />
          </div>
        </header>
        <div className="border-b bg-background/60 px-3 py-2 backdrop-blur lg:hidden">
          <NavItems />
        </div>

        <main className="relative flex flex-1 flex-col min-h-0 overflow-y-auto">
          <div className="grid-texture pointer-events-none absolute inset-0 -z-10" />
          {children}
        </main>
      </div>

      <OnboardingModal />
      <AuthDialog />
    </div>
  );
}
