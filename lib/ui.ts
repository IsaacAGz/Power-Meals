const buttonBase =
  "group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-control px-5 text-[15px] font-semibold transition-[transform,background-color,color,border-color] duration-200 ease-out-expo active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

export const buttonPrimary = `${buttonBase} bg-power text-ink hover:bg-power-deep`;
export const buttonSecondary = `${buttonBase} border border-ink text-ink hover:bg-ink hover:text-cream`;
export const buttonDark = `${buttonBase} bg-ink text-cream hover:bg-[#2a2a2a]`;

export const container = "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10";

export const textLink =
  "font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 transition-colors hover:decoration-ink";
