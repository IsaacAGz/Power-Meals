import { container } from "@/lib/ui";

export function TooManyRequests() {
  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={`${container} max-w-[760px]`}>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Demasiadas solicitudes</h1>
        <p className="mt-4 text-lg text-muted">Espera un minuto y vuelve a cargar la página.</p>
      </div>
    </section>
  );
}
