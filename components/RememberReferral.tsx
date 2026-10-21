"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export const REFERRAL_KEY = "oddaroa-ref";

/** Keeps a sub-admin code from ?ref= so it is still there when they register. */
function Remember() {
  const ref = useSearchParams().get("ref");

  useEffect(() => {
    const code = ref?.trim().toUpperCase();
    if (!code) return;
    try {
      localStorage.setItem(REFERRAL_KEY, code);
    } catch {
      /* private mode — the register page still reads the URL */
    }
  }, [ref]);

  return null;
}

export function RememberReferral() {
  return (
    <Suspense fallback={null}>
      <Remember />
    </Suspense>
  );
}
