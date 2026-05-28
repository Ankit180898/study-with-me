import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type Listener = (count: number) => void;

interface Entry {
  channel: RealtimeChannel;
  count: number;
  listeners: Set<Listener>;
  refs: number;
}

// one shared channel per topic, ref-counted across all hook instances
const entries = new Map<string, Entry>();

/**
 * Subscribe to presence on a topic. Multiple callers share a single channel,
 * so we never attach `.on()` to an already-subscribed channel. Returns an
 * unsubscribe function that tears the channel down when the last caller leaves.
 */
export function subscribePresence(
  sb: SupabaseClient,
  userId: string,
  topic: string,
  cb: Listener,
  opts: { track?: boolean } = {},
): () => void {
  const { track = true } = opts;
  let entry = entries.get(topic);

  if (!entry) {
    const channel = sb.channel(`presence:${topic}`, {
      config: { presence: { key: userId } },
    });
    const created: Entry = { channel, count: 0, listeners: new Set(), refs: 0 };
    entries.set(topic, created);

    channel
      .on("presence", { event: "sync" }, () => {
        created.count = Object.keys(channel.presenceState()).length;
        created.listeners.forEach((l) => l(created.count));
      })
      .subscribe((status) => {
        // only mark ourselves present when `track` is set (e.g. global "studying now");
        // grid counts merely observe how many are actually in each room
        if (status === "SUBSCRIBED" && track) channel.track({ online_at: Date.now() });
      });

    entry = created;
  }

  entry.refs += 1;
  entry.listeners.add(cb);
  cb(entry.count);

  return () => {
    const e = entries.get(topic);
    if (!e) return;
    e.listeners.delete(cb);
    e.refs -= 1;
    if (e.refs <= 0) {
      sb.removeChannel(e.channel);
      entries.delete(topic);
    }
  };
}
