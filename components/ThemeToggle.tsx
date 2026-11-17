"use client";

import { useEffect, useSyncExternalStore, type MouseEvent } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { THEME_EVENT, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(THEME_EVENT));
}

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

const readTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

/** Sun/moon switch. The inline script in app/layout.tsx picks the first theme; this saves an explicit choice. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // null on the server and during hydration, so the button never mismatches the class the inline script set.
  const theme = useSyncExternalStore<Theme | null>(subscribe, readTheme, () => null);

  // Follow the device setting while the visitor has not chosen.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      if (!savedTheme()) apply(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the switch still works for this page view.
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof document.startViewTransition !== "function") {
      apply(next);
      return;
    }

    // The new theme grows as a circle out of the button, over a snapshot of the old one.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(() => apply(next));
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 550, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {
        // Skipped transition (tab hidden, another transition started): the theme is already applied.
      });
  };

  const label = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-ink/5 ${className}`}
    >
      {theme === "dark" ? (
        <Sun weight="bold" className="size-5" aria-hidden />
      ) : (
        <Moon weight="bold" className="size-5" aria-hidden />
      )}
    </button>
  );
}
