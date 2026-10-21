import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

/**
 * Deletes the signed-in player's profile.
 *
 * Related bets, payments and push rows cascade. A partner row that points at
 * this player keeps the partner and only drops the link.
 */
export async function POST(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: user } = await supabase.from("users").select("id").eq("id", body.userId).maybeSingle();
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const { error } = await supabase.from("users").delete().eq("id", user.id);
  if (error) {
    console.error("[account] delete failed", error);
    return NextResponse.json({ error: "Could not delete your profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
