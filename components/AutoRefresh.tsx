"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const EVERY_MS = 5 * 60 * 1000;

/**
 * Reloads the player site every five minutes so odds, scores and balances
 * catch up without anyone pulling to refresh. The operator console is left
 * alone: a reload there would wipe a form that is still being filled in.
 */
export function AutoRefresh() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      window.location.reload();
    }, EVERY_MS);
    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
