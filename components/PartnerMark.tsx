export type PartnerShape = "circle" | "square" | "diamond" | "arch" | "ring" | "split";

function Shape({ shape }: { shape: PartnerShape }) {
  switch (shape) {
    case "circle":
      return <circle cx="20" cy="20" r="18" fill="currentColor" />;
    case "square":
      return <rect x="2" y="2" width="36" height="36" rx="6" fill="currentColor" />;
    case "diamond":
      return <rect x="8" y="8" width="24" height="24" rx="3" transform="rotate(45 20 20)" fill="currentColor" />;
    case "arch":
      return <path d="M2 38V20a18 18 0 0 1 36 0v18Z" fill="currentColor" />;
    case "ring":
      return <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" strokeWidth="6" />;
    case "split":
      return (
        <>
          <rect x="2" y="2" width="17" height="36" rx="4" fill="currentColor" />
          <rect x="21" y="2" width="17" height="36" rx="4" fill="currentColor" opacity="0.35" />
        </>
      );
  }
}

export function PartnerMark({ name, shape }: { name: string; shape: PartnerShape }) {
  return (
    <span className="inline-flex items-center gap-3 text-ink">
      <svg viewBox="0 0 40 40" className="size-9 shrink-0" aria-hidden>
        <Shape shape={shape} />
      </svg>
      <span className="font-display text-xl font-extrabold tracking-tight">{name}</span>
    </span>
  );
}
