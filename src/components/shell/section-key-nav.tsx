"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const IGNORE =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="listbox"], [role="menu"], [role="dialog"], [role="slider"]';

/** ←/→ switch sections, for presenting. Charts with keyboard focus handle arrows themselves. */
export function SectionKeyNav({ prevHref, nextHref }: { prevHref: string | null; nextHref: string | null }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest(IGNORE)) return;
      // An open popup (environment select) owns the keyboard.
      if (document.querySelector("[data-popup-open]")) return;
      const href = event.key === "ArrowLeft" ? prevHref : nextHref;
      if (!href) return;
      event.preventDefault();
      router.push(href, { scroll: false });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevHref, nextHref, router]);

  return null;
}
