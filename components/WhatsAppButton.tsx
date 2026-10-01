import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { buildWhatsAppUrl, GENERAL_MESSAGE } from "@/lib/whatsapp";
import { buttonDark, buttonPrimary, buttonSecondary } from "@/lib/ui";

type WhatsAppButtonProps = {
  message?: string;
  label?: string;
  variant?: "primary" | "secondary" | "dark";
  className?: string;
};

const variants = { primary: buttonPrimary, secondary: buttonSecondary, dark: buttonDark };

export function WhatsAppButton({
  message = GENERAL_MESSAGE,
  label = "Escríbenos por WhatsApp",
  variant = "secondary",
  className = "",
}: WhatsAppButtonProps) {
  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${variants[variant]} ${className}`}
    >
      <WhatsappLogo weight="bold" className="size-5" aria-hidden />
      {label}
    </a>
  );
}
