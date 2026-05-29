import { StatsGrid } from "@/components/stats-grid";
import { WeeklyChart } from "@/components/weekly-chart";
import { RecentSessions } from "@/components/recent-sessions";
import { PageHeader } from "@/components/page-header";
import { FocusHeatmap } from "@/components/focus-heatmap";

export default function InsightsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Insights"
        subtitle="Your focus, streaks, and history at a glance."
      />
      <div className="space-y-6">
        <StatsGrid />
        <FocusHeatmap />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <WeeklyChart />
          <RecentSessions />
        </div>
      </div>
    </div>
  );
}
