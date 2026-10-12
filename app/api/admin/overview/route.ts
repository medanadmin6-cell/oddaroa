import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** Platform totals for the overview page, broken out by currency. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Ghana runs on UTC, so midnight UTC is the start of the operator's day.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();

  const [
    { data: payments },
    { count: players },
    { count: depositors },
    { data: openBets },
    { count: pendingDeposits },
    { data: paymentsToday },
    { data: commissionsToday },
  ] = await Promise.all([
    supabase.from("payments").select("amount, currency, status, metadata").limit(5000),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).gt("total_deposited", 0),
    supabase.from("bets").select("stake, potential_win, currency").eq("status", "pending").limit(2000),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("provider", "manual"),
    supabase
      .from("payments")
      .select("amount, currency, status, metadata")
      .gte("created_at", dayStartIso)
      .limit(5000),
    supabase
      .from("commissions")
      .select("amount, currency")
      .gte("created_at", dayStartIso)
      .limit(5000),
  ]);

  const deposits: Record<string, number> = {};
  const withdrawals: Record<string, number> = {};

  for (const p of payments ?? []) {
    const meta = (p.metadata ?? {}) as { type?: string };
    const settled = p.status === "confirmed" || p.status === "resolved";
    if (!settled) continue;
    const bucket = meta.type === "withdrawal" ? withdrawals : deposits;
    bucket[p.currency] = Math.round(((bucket[p.currency] ?? 0) + Number(p.amount)) * 100) / 100;
  }

  // Today's credited deposits, same settled/withdrawal rules as the all-time total.
  const depositsToday: Record<string, number> = {};
  for (const p of paymentsToday ?? []) {
    const meta = (p.metadata ?? {}) as { type?: string };
    const settled = p.status === "confirmed" || p.status === "resolved";
    if (!settled || meta.type === "withdrawal") continue;
    depositsToday[p.currency] =
      Math.round(((depositsToday[p.currency] ?? 0) + Number(p.amount)) * 100) / 100;
  }

  // Today's sub-admin commission earned, by currency.
  const commissionToday: Record<string, number> = {};
  for (const c of commissionsToday ?? []) {
    commissionToday[c.currency] =
      Math.round(((commissionToday[c.currency] ?? 0) + Number(c.amount)) * 100) / 100;
  }

  // The house's share: today's deposits less the commission paid out on them.
  const adminToday: Record<string, number> = {};
  for (const currency of new Set([...Object.keys(depositsToday), ...Object.keys(commissionToday)])) {
    adminToday[currency] =
      Math.round(((depositsToday[currency] ?? 0) - (commissionToday[currency] ?? 0)) * 100) / 100;
  }

  const liability: Record<string, number> = {};
  let openStake = 0;
  for (const b of openBets ?? []) {
    liability[b.currency] = Math.round(((liability[b.currency] ?? 0) + Number(b.potential_win)) * 100) / 100;
    openStake += Number(b.stake);
  }

  return NextResponse.json({
    deposits,
    withdrawals,
    depositsToday,
    commissionToday,
    adminToday,
    players: players ?? 0,
    depositors: depositors ?? 0,
    openTickets: openBets?.length ?? 0,
    openStake: Math.round(openStake * 100) / 100,
    liability,
    pendingDeposits: pendingDeposits ?? 0,
  });
}
