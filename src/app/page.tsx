import { TimerCard } from "@/components/timer-card";
import { TodayProgress } from "@/components/today-progress";
import { FocusingTogether } from "@/components/focusing-together";
import { PageHeader } from "@/components/page-header";
import { StreakHero } from "@/components/streak-hero";

export default function FocusPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader title="Focus" subtitle="Pick a mode, press start, and stay in flow." />
      <div className="space-y-6">
        <StreakHero />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <TimerCard />
          <div className="space-y-6">
            <TodayProgress />
            <FocusingTogether />
          </div>
        </div>
      </div>
    </div>
  );
}
