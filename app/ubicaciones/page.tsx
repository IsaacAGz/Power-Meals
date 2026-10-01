import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { LocationsExplorer } from "@/components/map/LocationsExplorer";
import { container, textLink } from "@/lib/ui";
import { buildWhatsAppUrl, ZONE_QUESTION_MESSAGE } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Ubicaciones",
  description: "Zonas de entrega y puntos de recolección de Power Meals en Tijuana.",
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
            Entregamos en cinco zonas de Tijuana y tenemos dos puntos de recolección. ¿Tu colonia no aparece?{" "}
            <a href={buildWhatsAppUrl(ZONE_QUESTION_MESSAGE)} target="_blank" rel="noopener noreferrer" className={textLink}>
              Pregunta por tu zona
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
