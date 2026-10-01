import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { LocationsExplorer } from "@/components/map/LocationsExplorer";
import { container, textLink } from "@/lib/ui";
import { buildWhatsAppUrl, PICKUP_QUESTION_MESSAGE } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Ubicaciones",
  description: "Puntos de recolección de Power Meals en Tijuana.",
};

export default function UbicacionesPage() {
  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={container}>
        <Reveal onMount>
          <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-7xl">Ubicaciones</h1>
        </Reveal>
        <Reveal onMount delay={0.08}>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted">
            Recoge tu pedido en estos puntos de Tijuana. ¿Necesitas otro horario o lugar?{" "}
            <a href={buildWhatsAppUrl(PICKUP_QUESTION_MESSAGE)} target="_blank" rel="noopener noreferrer" className={textLink}>
              Pregúntanos
            </a>
            .
          </p>
        </Reveal>
        <div className="mt-12">
          <LocationsExplorer />
        </div>
      </div>
    </section>
  );
}
