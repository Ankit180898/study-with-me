import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

// livekit-server-sdk uses Node APIs (Buffer, crypto), so this can't run on the Edge.
export const runtime = "nodejs";

interface Body {
  roomId?: string;
  name?: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: "LiveKit not configured on server" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const roomId = (body.roomId ?? "").toString().slice(0, 64);
  const displayName = (body.name ?? "").toString().slice(0, 60);
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // Verify the user via their Supabase access token; identity must be authoritative.
  const auth = req.headers.get("authorization") ?? "";
  const accessToken = auth.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: data.user.id,
    name: displayName || `Guest ${data.user.id.slice(0, 4)}`,
    ttl: 60 * 60, // 1 hour
  });
  at.addGrant({
    roomJoin: true,
    room: `swm:${roomId}`,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url: wsUrl });
}
