import { notFound } from "next/navigation";
import { RoomView } from "@/components/room-view";
import { getRoom, ROOMS } from "@/lib/rooms";

export function generateStaticParams() {
  return ROOMS.map((r) => ({ id: r.id }));
}

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getRoom(id)) notFound();
  return <RoomView roomId={id} />;
}
