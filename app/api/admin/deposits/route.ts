import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-guard";
import { applyDepositCredit, reverseDeposit } from "@/lib/money";

export const dynamic = "force-dynamic";

/** Manual deposits awaiting confirmation, each with the player's screenshot. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data } = await supabase
    .from("payments")
    .select("reference, amount, currency, provider, status, metadata, created_at, users!inner(id, name, phone, country_code)")
    .in("status", ["pending", "failed"])
    .eq("metadata->>type", "deposit")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];
  const manual = rows.filter((p) => p.provider === "manual" && p.status === "pending");
  // Gateway charges that never credited. A missed webhook leaves them pending,
  // and a rejected signature can mark a paid one failed, so both can be approved.
  const awaiting = rows.filter((p) => p.provider !== "manual");

  // Screenshots live in a private bucket, so hand out short-lived signed URLs.
  const withUrls = await Promise.all(
    manual.map(async (d) => {
      const meta = (d.metadata ?? {}) as { screenshot?: string | null; sender_number?: string };
      let screenshotUrl: string | null = null;
      if (meta.screenshot) {
        const { data: signed } = await supabase.storage
          .from("deposit-screenshots")
          .createSignedUrl(meta.screenshot, 600);
        screenshotUrl = signed?.signedUrl ?? null;
      }
      return { ...d, screenshotUrl, senderNumber: meta.sender_number ?? null };
    }),
  );

  return NextResponse.json({
    deposits: withUrls,
    awaiting: awaiting.map((d) => {
      const meta = (d.metadata ?? {}) as { network?: string };
      return {
        reference: d.reference,
        amount: d.amount,
        currency: d.currency,
        provider: d.provider,
        status: d.status,
        network: meta.network ?? null,
        created_at: d.created_at,
        users: d.users,
      };
    }),
  });
}

/** Credit and resolve in one step, or delete a mistaken deposit. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: { reference?: string; action?: "confirm" | "reject" | "delete" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { reference, action } = body;
  if (!reference || !action) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (action === "delete") {
    // Reverses the money and gives back the qualifying-deposit tick.
    const result = await reverseDeposit(reference);
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: result.reason }, { status: 400 });
  }

  if (action === "reject") {
    await supabase.from("payments").update({ status: "failed" }).eq("reference", reference);
    return NextResponse.json({ ok: true });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("user_id, amount, currency, provider")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Manual confirmations go through the same choke point as every other rail,
  // so the bonus, commission, verification and gate steps all still run.
  const result = await applyDepositCredit({
    userId: payment.user_id,
    amount: Number(payment.amount),
    currency: payment.currency,
    reference,
    provider: payment.provider,
  });

  if (!result.credited && !result.duplicate) {
    return NextResponse.json({ error: result.reason ?? "Could not credit" }, { status: 400 });
  }

  await supabase
    .from("payments")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("reference", reference);

  return NextResponse.json({ ok: true, balance: result.balance });
}
