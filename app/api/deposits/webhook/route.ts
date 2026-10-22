import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/supabase";
import { applyDepositCredit } from "@/lib/money";

/**
 * Gateway webhooks. One endpoint, one shape per provider.
 *
 * The signature is verified before anything is read out of the body, and the
 * credit itself is idempotent, so a provider retrying the same event is
 * harmless.
 */
export async function POST(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });

  const raw = await req.text();
  const provider = detectProvider(req);

  if (!verify(provider, req, raw)) {
    console.warn("[webhook] rejected bad signature", provider);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { reference, successful } = extract(provider, event);
  if (!reference) return NextResponse.json({ ok: true, ignored: true });

  const { data: payment } = await supabase
    .from("payments")
    .select("reference, user_id, amount, currency, provider, status")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment) return NextResponse.json({ ok: true, ignored: true });

  if (!successful) {
    if (payment.status === "pending") {
      await supabase.from("payments").update({ status: "failed" }).eq("reference", reference);
    }
    return NextResponse.json({ ok: true });
  }

  await applyDepositCredit({
    userId: payment.user_id,
    amount: Number(payment.amount),
    currency: payment.currency,
    reference,
    provider: payment.provider,
  });

  return NextResponse.json({ ok: true });
}

function detectProvider(req: Request): string {
  if (req.headers.get("x-akwapay-signature")) return "akwapay";
  if (req.headers.get("x-korapay-signature")) return "korapay";
  if (req.headers.get("x-paystack-signature")) return "paystack";
  return "moolre";
}

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function verify(provider: string, req: Request, raw: string): boolean {
  switch (provider) {
    case "paystack": {
      const key = process.env.PAYSTACK_SECRET_KEY;
      if (!key) return false;
      const expected = createHmac("sha512", key).update(raw).digest("hex");
      return safeCompare(req.headers.get("x-paystack-signature") ?? "", expected);
    }
    case "akwapay":
      return verifyAkwaPay(req, raw);
    case "korapay": {
      const key = process.env.KORAPAY_SECRET_KEY;
      if (!key) return false;
      let payload = raw;
      try {
        payload = JSON.stringify(JSON.parse(raw).data);
      } catch {
        /* fall back to the raw body */
      }
      const expected = createHmac("sha256", key).update(payload).digest("hex");
      return safeCompare(req.headers.get("x-korapay-signature") ?? "", expected);
    }
    default: {
      const secret = process.env.MOOLRE_WEBHOOK_SECRET;
      if (!secret) return false;
      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      return safeCompare(req.headers.get("x-moolre-signature") ?? "", expected);
    }
  }
}

function extract(provider: string, event: Record<string, unknown>): { reference?: string; successful: boolean } {
  const data = (event.data ?? event) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  switch (provider) {
    case "paystack":
      return {
        reference: str(data.reference),
        successful: String(event.event ?? "") === "charge.success",
      };
    case "akwapay":
      return extractAkwaPay(event);
    case "korapay":
      return {
        reference: str(data.reference),
        successful: String(event.event ?? "") === "charge.success",
      };
    default:
      return {
        reference: str(data.externalref) ?? str(data.reference),
        successful: Number(data.txstatus ?? data.status) === 1,
      };
  }
}

/**
 * AkwaPay signs the raw body with the endpoint secret. The header is either
 * Stripe-style `t=<unix>,v1=<hex>` or a bare hex digest, and the timestamp may
 * arrive on its own header. A delivery older than five minutes is rejected.
 */
function verifyAkwaPay(req: Request, raw: string): boolean {
  const secret = process.env.AKWAPAY_WEBHOOK_SECRET || "";
  const header = (req.headers.get("x-akwapay-signature") ?? "").trim();
  if (!secret || !header) return false;

  const parts = new Map<string, string>();
  for (const piece of header.split(",")) {
    const idx = piece.indexOf("=");
    if (idx === -1) continue;
    parts.set(piece.slice(0, idx).trim(), piece.slice(idx + 1).trim());
  }
  const timestamp = parts.get("t") || req.headers.get("x-akwapay-timestamp") || "";
  if (timestamp) {
    const n = Number(timestamp);
    const ms = n > 1e12 ? n : n * 1000;
    if (!Number.isFinite(ms) || Math.abs(Date.now() - ms) > 5 * 60 * 1000) return false;
  }

  const presented = parts.get("v1") || (header.includes("=") ? "" : header);
  if (!presented) return false;

  const keys = secret.startsWith("whsec_") ? [secret, secret.slice("whsec_".length)] : [secret];
  const payloads = timestamp ? [`${timestamp}.${raw}`, `${timestamp}${raw}`, raw] : [raw];
  for (const key of keys) {
    for (const payload of payloads) {
      const expected = createHmac("sha256", key).update(payload).digest("hex");
      if (safeCompare(presented.toLowerCase(), expected)) return true;
    }
  }
  return false;
}

function extractAkwaPay(event: Record<string, unknown>): { reference?: string; successful: boolean } {
  const data = (
    event.data && typeof event.data === "object" ? event.data : event
  ) as Record<string, unknown>;
  const object = (
    data.object && typeof data.object === "object" ? data.object : data
  ) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const reference = str(object.reference) ?? str(data.reference) ?? str(event.reference);
  const type = String(event.type ?? event.event ?? "").toLowerCase();
  const status = String(object.status ?? data.status ?? "").toLowerCase();
  const success =
    type.endsWith(".succeeded") ||
    type.endsWith(".paid") ||
    ["succeeded", "paid", "successful", "completed", "success"].includes(status);
  const failure =
    type.endsWith(".failed") ||
    type.endsWith(".canceled") ||
    type.endsWith(".cancelled") ||
    ["failed", "canceled", "cancelled", "expired"].includes(status);
  // A progress ping is not a result. Leaving the reference off keeps the
  // pending deposit pending instead of marking it failed.
  if (!reference || (!success && !failure)) return { successful: false };
  return { reference, successful: success && !failure };
}
