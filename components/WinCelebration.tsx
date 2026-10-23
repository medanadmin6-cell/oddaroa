"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Share2, Check } from "lucide-react";
import { Trophy } from "@/components/Trophy";
import { formatMoney } from "@/lib/countries";
import { copyText } from "@/lib/clipboard";

/**
 * The winning-ticket celebration.
 *
 * Shown once per ticket. Which tickets have already been celebrated is kept in
 * browser storage, so a settled win is announced when the player next opens the
 * app and never again after that — a modal that reappears on every visit stops
 * being a celebration and becomes an obstacle.
 */

const SEEN_KEY = "betlixx-celebrated";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Records a ticket as celebrated. Returns true if this is the first time. */
export function markCelebrated(code: string): boolean {
  try {
    const seen = readSeen();
    if (seen.includes(code)) return false;
    // Keep the list bounded; nobody needs a celebration history.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, code].slice(-200)));
    return true;
  } catch {
    return false;
  }
}

export function hasCelebrated(code: string): boolean {
  return readSeen().includes(code);
}

export function WinCelebration({
  code,
  amount,
  currency,
  onClose,
  detailsHref,
}: {
  code: string;
  amount: number;
  currency: string;
  onClose: () => void;
  /** Where Details goes. With no link, Details just closes the cup. */
  detailsHref?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    const text = `I just won ${formatMoney(amount, currency)} on Oddaroa. Ticket ${code}.`;
    const url = typeof window !== "undefined" ? window.location.origin : "";

    if (navigator.share) {
      try {
        await navigator.share({ title: "Oddaroa win", text, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    try {
      await copyText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const detailsClass =
    "rounded-2xl border-2 border-white/90 bg-black/40 py-3.5 text-center text-[16px] font-bold text-white";

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label={`You won ${formatMoney(amount, currency)}`}
    >
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close" />

      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 text-white/80"
      >
        <X size={26} strokeWidth={2} />
      </button>

      <div className="relative flex h-full flex-col items-center justify-center px-5 pb-6">
        <p className="win-line text-center text-[44px] font-black leading-none tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
          YOU WON
        </p>
        <p
          className="win-line mt-2 text-center text-[30px] font-black leading-none text-[#f5c518] drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]"
          style={{ animationDelay: "0.08s" }}
        >
          {formatMoney(amount, currency)}
        </p>

        {/* Two wrappers: one throws the cup up, the other keeps it breathing. */}
        <div className="win-cup -my-2">
          <div className="win-cup-float">
            <Trophy animated size={320} className="drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]" />
          </div>
        </div>

        <div className="win-line grid w-full max-w-sm grid-cols-2 gap-3" style={{ animationDelay: "0.35s" }}>
          {detailsHref ? (
            <Link href={detailsHref} onClick={onClose} className={detailsClass}>
              Details
            </Link>
          ) : (
            <button type="button" onClick={onClose} className={detailsClass}>
              Details
            </button>
          )}
          <button
            type="button"
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#22c55e] py-3.5 text-[16px] font-black text-white"
          >
            {copied ? <Check size={16} strokeWidth={2.6} /> : <Share2 size={16} strokeWidth={2.2} />}
            {copied ? "Copied" : "Show Off"}
          </button>
        </div>
      </div>
    </div>
  );
}
