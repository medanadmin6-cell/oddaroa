import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/supabase";
import { settleBets } from "@/lib/settle";

const COLUMNS =
  "id, code, stake, total_odds, potential_win, currency, status, payout, settled_at, created_at";

/** Every ticket in these statuses, paged so the history is not capped at 100. */
async function listBets(supabase: SupabaseClient, userId: string, statuses: string[]) {
  const pageSize = 400;
  const rows: { id: string }[] = [];
  for (let from = 0; from < 4000; from += pageSize) {
    const { data, error } = await supabase
      .from("bets")
      .select(COLUMNS)
      .eq("user_id", userId)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { error, rows };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return { error: null, rows };
}

async function listLegs(supabase: SupabaseClient, betIds: string[]) {
  const legs: { bet_id: string }[] = [];
  for (let i = 0; i < betIds.length; i += 100) {
    const { data } = await supabase
      .from("bet_selections")
      .select(
        "bet_id, match_id, home_team, away_team, league, market, outcome, odds, result, kickoff, final_home, final_away",
      )
      .in("bet_id", betIds.slice(i, i + 100));
    legs.push(...(data ?? []));
  }
  return legs;
}

export const dynamic = "force-dynamic";

/**
 * A player's tickets. Opening My Bets settles that player's own tickets first,
 * so the list they are about to read is already up to date.
 */
export async function GET(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await settleBets({ userId }).catch((err) => console.error("[my-bets] settle failed", err));

  // Open tickets and settled tickets are loaded apart, so a long run of open
  // bets cannot push won, lost, and cashed-out tickets off the history.
  const [open, settled] = await Promise.all([
    listBets(supabase, userId, ["pending"]),
    listBets(supabase, userId, ["won", "lost", "cashed_out", "void"]),
  ]);

  if (open.error || settled.error) {
    return NextResponse.json({ error: "Could not load your bets" }, { status: 500 });
  }

  const bets = [...open.rows, ...settled.rows];
  if (!bets.length) return NextResponse.json({ bets: [] });

  const legs = await listLegs(
    supabase,
    bets.map((b) => b.id),
  );

  const byTicket = new Map<string, unknown[]>();
  for (const leg of legs ?? []) {
    const list = byTicket.get(leg.bet_id) ?? [];
    list.push(leg);
    byTicket.set(leg.bet_id, list);
  }

  return NextResponse.json({
    bets: bets.map((b) => ({ ...b, selections: byTicket.get(b.id) ?? [] })),
  });
}
