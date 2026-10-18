"use client";

import { useEffect, useRef } from "react";

const SCRIPT_SELECTOR = 'script[data-turnstile="explicit"]';
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

/** Explicit Cloudflare widget. Calls onToken with "" when the token expires or the challenge errors. */
export function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = turnstileSiteKey();
  const container = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    const element = container.current;
    if (!siteKey || !element) return;
    let widgetId = "";
    let cancelled = false;

    const render = () => {
      if (cancelled || widgetId || !window.turnstile || !container.current) return;
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      let script = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.dataset.turnstile = "explicit";
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      return () => {
        cancelled = true;
        script?.removeEventListener("load", render);
        if (widgetId) window.turnstile?.remove(widgetId);
      };
    }

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={container} className="min-h-[65px]" />;
}
