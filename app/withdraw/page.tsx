"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/Shell";
import { useSession } from "@/lib/store";
import { getCountry, formatMoney } from "@/lib/countries";
import { RequestSubmitted } from "@/components/RequestSubmitted";
import { VerifyGate } from "@/components/VerifyGate";
import { showWithdrawalIos } from "@/lib/withdrawal-ios";

interface DepositProgress {
  have: number;
  need: number;
  amount: number;
  counted?: boolean;
}

export default function WithdrawPage() {
  const router = useRouter();
  const player = useSession((s) => s.player);
  const hydrated = useSession((s) => s.hydrated);
  const setBalance = useSession((s) => s.setBalance);

  const [amount, setAmount] = useState(0);
  const [payoutNumber, setPayoutNumber] = useState("");
  const [payoutBank, setPayoutBank] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ title: string; message: string } | null>(null);
  const [verify, setVerify] = useState<DepositProgress | null>(null);
  const [checking, setChecking] = useState(false);

  const country = player ? getCountry(player.country_code) : getCountry("GH");

  useEffect(() => {
    if (hydrated && !player) router.replace("/login");
  }, [hydrated, player, router]);

  const fetchMe = useCallback(async () => {
    if (!player) return null;
    try {
      const res = await fetch(`/api/me?userId=${player.id}`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }, [player]);

  const apply = useCallback(
    (j: {
      user: { payout_number?: string | null; payout_bank?: string | null; balance?: number };
      withdrawal?: { failed?: string; hasWon?: boolean; progress?: DepositProgress };
    }) => {
      setPayoutNumber((n) => n || j.user.payout_number || player?.phone || "");
      setPayoutBank((b) => b || j.user.payout_bank || "");
      if (typeof j.user.balance === "number") setBalance(Number(j.user.balance));
      const progress = j.withdrawal?.progress;
      // Three deposits of the qualifying amount, shown as soon as a player
      // opens withdraw. A quiet failure used to leave a winner with no idea
      // why the money would not leave.
      if (
        j.withdrawal?.hasWon &&
        progress?.counted &&
        progress.have < progress.need &&
        j.withdrawal?.failed !== "approval"
      ) {
        setVerify(progress);
      } else {
        setVerify(null);
      }
    },
    [player, setBalance],
  );

  useEffect(() => {
    let alive = true;
    void fetchMe().then((j) => {
      if (alive && j) apply(j);
    });
    return () => {
      alive = false;
    };
  }, [fetchMe, apply]);

  if (!player) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: player.id, amount, payoutNumber, payoutBank }),
      });
      const json = await res.json();

      if (!res.ok) {
        const progress = json.progress as DepositProgress | undefined;
        if (json.gate === "deposits" && progress?.counted && progress.have < progress.need) {
          setVerify(progress);
          return;
        }
        setError(json.error ?? "Could not submit your withdrawal");
        return;
      }

      // Awaiting an operator reads differently from already on its way, so the
      // heading follows the endpoint rather than assuming one of them.
      setSubmitted({
        title: json.status === "processing" ? "Pending Request" : "Withdrawal sent",
        message: json.message,
      });
      if (typeof json.balance === "number") setBalance(json.balance);
      const paid = Number(json.amount);
      const left = Number(json.balance);
      if (
        json.notify === true &&
        (json.status === "submitted" || json.status === "processing") &&
        Number.isFinite(paid) &&
        paid > 0 &&
        Number.isFinite(left)
      ) {
        showWithdrawalIos({
          amount: paid,
          currentBalance: left,
          currency: typeof json.currency === "string" && json.currency ? json.currency : player.currency,
        });
      }
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    setChecking(true);
    const j = await fetchMe();
    if (j) apply(j);
    setChecking(false);
  };

  return (
    <Page>
      {verify && (
        <VerifyGate
          amount={verify.amount}
          currency={player.currency}
          have={verify.have}
          need={verify.need}
          checking={checking}
          onBack={() => router.back()}
          onRecheck={recheck}
        />
      )}
      {submitted && <RequestSubmitted title={submitted.title} message={submitted.message} />}

      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-[18px] font-black">Withdraw</h1>

        <div className="rounded-lg bg-[var(--bg-elevated)] p-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Available</p>
          <p className="text-[26px] font-black text-[var(--accent)]">
            {formatMoney(Number(player.balance), player.currency)}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-lg bg-[var(--bg-elevated)] p-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              Amount ({country.currency})
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-lg bg-[var(--surface-2)] px-3 py-3 text-[20px] font-black outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              {country.payoutRail === "mobile" ? "Mobile money number" : "Account number"}
            </span>
            <input
              value={payoutNumber}
              onChange={(e) => setPayoutNumber(e.target.value)}
              className="w-full rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>

          {country.payoutRail === "bank" && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                Bank
              </span>
              <input
                value={payoutBank}
                onChange={(e) => setPayoutBank(e.target.value)}
                className="w-full rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={busy || amount <= 0}
            className="w-full rounded-lg bg-[var(--accent)] py-3 text-[14px] font-black text-[var(--accent-ink)] disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Request withdrawal"}
          </button>
        </form>

        {message && (
          <p className="rounded-lg bg-[var(--win)]/15 px-3 py-2.5 text-[12px] text-[var(--win)]">{message}</p>
        )}
        {error && (
          <p className="rounded-lg bg-[var(--lose)]/15 px-3 py-2.5 text-[12px] text-[var(--lose)]">{error}</p>
        )}
      </div>
    </Page>
  );
}
