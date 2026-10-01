import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 rounded-control font-display text-[19px] font-extrabold tracking-tight text-ink ${className}`}
    >
      <Image src="/logo.svg" alt="" width={32} height={32} className="size-8" />
      <span>Power Meals</span>
    </Link>
  );
}
