import Image from "next/image";
import Link from "next/link";

/** Power Meals wordmark (transparent PNG; black letters with a gold outline read on cream and on black). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center rounded-control ${className}`}>
      <Image
        src="/brand/power-meals-wordmark.png"
        alt="Power Meals, inicio"
        width={640}
        height={200}
        loading="eager"
        className="h-9 w-auto"
      />
    </Link>
  );
}
