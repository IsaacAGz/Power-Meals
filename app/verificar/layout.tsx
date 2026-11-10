import type { Metadata } from "next";

// The page is a client component, so its metadata lives here. The URL carries a one-time token.
export const metadata: Metadata = {
  title: "Confirmar correo",
  robots: { index: false },
};

export default function VerificarLayout({ children }: LayoutProps<"/verificar">) {
  return children;
}
