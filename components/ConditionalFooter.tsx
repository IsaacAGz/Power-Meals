"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The kitchen board keeps the marketing footer off the screen. */
export function ConditionalFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/kitchen")) return null;
  return children;
}
