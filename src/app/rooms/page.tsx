import { RoomsGrid } from "@/components/rooms-grid";
import { PageHeader } from "@/components/page-header";
import { LiveUsers } from "@/components/live-users";

export default function RoomsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Live rooms"
        subtitle="Body-doubling works. Drop into a room and focus alongside others."
        action={<LiveUsers />}
      />
      <RoomsGrid />
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Rooms are simulated for now — real presence & video arrive with Supabase Realtime.
      </p>
    </div>
  );
}
