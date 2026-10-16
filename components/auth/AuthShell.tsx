import type { ReactNode } from "react";
import { container } from "@/lib/ui";

export function AuthShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={container}>
        <div className="mx-auto max-w-[560px]">
          <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">{title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">{intro}</p>
          <div className="mt-10 rounded-frame border border-line-strong bg-paper p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
