import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRIVACY } from "@/lib/constants";
import { isOpenpayConfigured } from "@/lib/openpay";
import { container, textLink } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Cómo Power Meals trata los datos personales de sus clientes y cómo ejercer tus derechos ARCO.",
};

// Draft for legal review (PLAN.md). It describes what the app actually does: keep it in step with the code when
// a field, a provider or a retention period changes.

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-10">
      <h2 id={id} className="font-display text-2xl font-extrabold tracking-tight">
        {title}
      </h2>
      <div className="mt-5 flex flex-col gap-4 text-[16px] leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-line-strong">{children}</ul>;
}

export default function AvisoDePrivacidadPage() {
  const openpay = isOpenpayConfigured();
  const mail = (
    <a href={`mailto:${PRIVACY.email}`} className={textLink}>
      {PRIVACY.email}
    </a>
  );

  return (
    <article className={`${container} pt-12 pb-24 md:pt-20 md:pb-32`}>
      <div className="max-w-[72ch]">
        <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">Aviso de privacidad</h1>
        <p className="mt-6 text-[15px] text-muted">Última actualización: {PRIVACY.updatedAt}</p>
        <p className="mt-6 text-lg leading-relaxed text-muted">
          En Power Meals usamos tus datos personales solo para atender tu cuenta y tus pedidos. Este aviso explica qué
          datos tratamos, para qué, con quién los compartimos y cómo ejercer tus derechos, conforme a la Ley Federal de
          Protección de Datos Personales en Posesión de los Particulares.
        </p>

        <div className="mt-12 flex flex-col gap-10">
          <Section id="responsable" title="Responsable">
            <p>
              <strong>{PRIVACY.controller}</strong>, que opera la marca Power Meals, con domicilio en {PRIVACY.address}, es
              responsable del tratamiento de tus datos personales. Para cualquier asunto relacionado con este aviso
              escríbenos a {mail}.
            </p>
          </Section>

          <Section id="datos" title="Datos que tratamos">
            <List>
              <li>
                <strong>Cuenta:</strong> nombre, correo electrónico, teléfono (opcional) y contraseña. La contraseña se
                guarda cifrada con un algoritmo de un solo sentido; nadie en Power Meals puede leerla.
              </li>
              <li>
                <strong>Pedidos:</strong> nombre, correo, teléfono, punto de recolección (o zona y dirección, cuando
                ofrezcamos entrega a domicilio), los platillos que pides, el total y las notas que agregues.
              </li>
              <li>
                <strong>Pago:</strong>{" "}
                {openpay
                  ? "si pagas con tarjeta, capturas los datos directamente en Openpay; nosotros no recibimos ni guardamos el número de tu tarjeta, solo el resultado del cobro. "
                  : ""}
                Si pagas por transferencia, el comprobante que nos envíes por WhatsApp.
              </li>
              <li>
                <strong>Datos técnicos:</strong> dirección IP, tipo de navegador y la cookie de sesión, que usamos para
                mantener tu sesión y tu carrito, proteger el sitio contra abuso y diagnosticar errores.
              </li>
            </List>
            <p>
              <strong>Datos sensibles.</strong> No te pedimos datos sensibles. Si en las notas de tu pedido nos escribes
              alergias, intolerancias o alguna condición de salud, esos datos se consideran sensibles. Al escribirlos y
              enviar tu pedido nos das tu consentimiento expreso para usarlos únicamente para preparar ese pedido.
            </p>
          </Section>

          <Section id="finalidades" title="Para qué usamos tus datos">
            <p>Finalidades necesarias para darte el servicio:</p>
            <List>
              <li>Crear y administrar tu cuenta, confirmar tu correo y restablecer tu contraseña cuando lo pidas.</li>
              <li>Recibir, preparar, cobrar y entregar tus pedidos, y mostrarte tu historial.</li>
              <li>Avisarte por correo o WhatsApp cuando confirmamos el pago, con el enlace a tu recibo.</li>
              <li>Atender tus dudas, aclaraciones y solicitudes.</li>
              <li>Proteger el sitio y tu cuenta: prevenir fraude y abuso, y detectar y corregir fallas.</li>
              <li>Cumplir con obligaciones legales, incluidas las fiscales.</li>
            </List>
            <p>
              No usamos tus datos para publicidad, mercadotecnia ni perfiles, y no los vendemos. Si algún día quisiéramos
              usarlos para otra finalidad, actualizaremos este aviso y te pediremos tu consentimiento antes.
            </p>
          </Section>

          <Section id="terceros" title="Con quién compartimos tus datos">
            <p>
              Para operar el sitio nos apoyamos en proveedores que tratan datos por cuenta nuestra, solo para prestarnos
              su servicio y bajo sus obligaciones de confidencialidad:
            </p>
            <List>
              <li>
                <strong>Amazon Web Services:</strong> servidores, base de datos, respaldos, registros y envío de correos.
                Los servidores están en Estados Unidos.
              </li>
              <li>
                <strong>Cloudflare:</strong> verificación anti-robots (Turnstile) al crear una cuenta o pedir el cambio de
                contraseña.
              </li>
              <li>
                <strong>Sentry:</strong> reporte de errores del sitio. Está configurado para no recibir cookies, cabeceras
                ni el contenido de los formularios.
              </li>
              <li>
                <strong>MapTiler:</strong> el mapa de ubicaciones, que recibe tu dirección IP para mostrarlo.
              </li>
              <li>
                <strong>WhatsApp (Meta):</strong> cuando eliges enviar tu pedido por WhatsApp, y para avisarte del pago
                si tu pedido no tiene correo.
              </li>
              {openpay && (
                <li>
                  <strong>Openpay:</strong> el cobro con tarjeta.
                </li>
              )}
            </List>
            <p>
              Fuera de estos proveedores, solo compartimos datos personales cuando lo exige una ley o lo ordena una
              autoridad competente.
            </p>
          </Section>

          <Section id="conservacion" title="Cuánto tiempo los conservamos">
            <p>
              Conservamos los datos de tu cuenta mientras esté activa, y los de tus pedidos el tiempo necesario para
              atenderlos y para cumplir con las obligaciones legales y fiscales que correspondan. Los registros técnicos
              del servidor se borran a los 30 días y los respaldos de la base de datos también se eliminan a los 30
              días.
            </p>
          </Section>

          <Section id="cookies" title="Cookies">
            <p>
              Usamos una sola cookie propia, <strong>pm_session</strong>, para mantener tu sesión y tu carrito. Es
              necesaria para pedir y dura hasta 30 días. No usamos cookies de publicidad ni de analítica. La verificación
              de Cloudflare puede usar tecnologías propias para distinguir personas de robots. Si bloqueas las cookies en
              tu navegador, no podrás iniciar sesión ni armar un pedido.
            </p>
          </Section>

          <Section id="derechos" title="Tus derechos ARCO y cómo revocar tu consentimiento">
            <p>
              Puedes <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong>, pedir que los{" "}
              <strong>cancelemos</strong> u <strong>oponerte</strong> a su tratamiento, así como revocar tu
              consentimiento o limitar el uso de tus datos. Para hacerlo, escríbenos a {mail} con:
            </p>
            <List>
              <li>Tu nombre y el correo o teléfono con el que haces pedidos, para responderte.</li>
              <li>Una copia de tu identificación oficial o, en su caso, la de tu representante y el documento que lo acredite.</li>
              <li>Qué derecho quieres ejercer y sobre qué datos, y cualquier documento que ayude a localizarlos.</li>
            </List>
            <p>
              Te responderemos por el mismo medio dentro de los plazos que establece la ley. Si cancelas tus datos,
              cerraremos tu cuenta; los datos de pedidos que debamos conservar por ley quedarán bloqueados hasta que
              termine ese plazo. Si consideras que no atendimos tu solicitud, puedes acudir a la Secretaría
              Anticorrupción y Buen Gobierno, autoridad en materia de protección de datos personales.
            </p>
          </Section>

          <Section id="cambios" title="Cambios a este aviso">
            <p>
              Publicaremos cualquier cambio en esta página con su fecha de actualización. Si el cambio afecta cómo usamos
              tus datos, también te avisaremos al correo de tu cuenta.
            </p>
          </Section>
        </div>
      </div>
    </article>
  );
}
