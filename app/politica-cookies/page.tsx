import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "../components/LegalPageShell";
import { TERMS_VERSION_LABEL } from "@/lib/legal/termsVersion";

export const metadata: Metadata = {
  title: "Política de Cookies — Transition LATAM",
  description: "Qué cookies y almacenamiento local usa Transition LATAM.",
};

const CONTACT_EMAIL = "patrick.bittig@onixcg.com";

export default function PoliticaCookiesPage() {
  return (
    <LegalPageShell title="Política de Cookies" updatedAt={TERMS_VERSION_LABEL}>
      <p>
        Esta política describe con exactitud qué cookies y almacenamiento local usa Transition LATAM. Se actualizará
        si el uso cambia — en particular, si en el futuro se incorpora analítica de terceros o publicidad, lo que
        hoy no ocurre.
      </p>

      <h2>1. Cookies estrictamente necesarias</h2>
      <p>
        Usamos únicamente las cookies que genera nuestro proveedor de autenticación (Supabase Auth) para mantener su
        sesión iniciada mientras usa la Plataforma. Sin estas cookies, no es posible iniciar sesión ni usar ninguna
        función que requiera cuenta. No pueden desactivarse de forma selectiva sin perder la funcionalidad de inicio
        de sesión.
      </p>

      <h2>2. Almacenamiento local del navegador</h2>
      <p>
        Además de las cookies, guardamos dos valores en el almacenamiento local de su navegador, que no salen de su
        equipo y no se comparten con ningún servidor: un registro de qué avisos flotantes de proyectos ya se le
        mostraron, para no repetírselos, y la fecha de su última revisión del panel de seguimiento. Puede borrar
        esta información desde la configuración de su navegador (“borrar datos de sitio”); el único efecto es que
        los avisos que ya vio podrían volver a mostrarse una vez.
      </p>

      <h2>3. Lo que no usamos</h2>
      <p>
        A la fecha de esta política, Transition LATAM no utiliza cookies de publicidad, cookies o píxeles de
        seguimiento entre sitios, ni herramientas de analítica de terceros. Todo el registro de comportamiento de
        uso se procesa en nuestros propios servidores y se rige por nuestra{" "}
        <Link href="/politica-privacidad">Política de Privacidad</Link>.
      </p>

      <h2>4. Cómo administrar las cookies</h2>
      <p>
        Puede configurar su navegador para bloquear o eliminar cookies. Dado que solo usamos cookies esenciales para
        la sesión, bloquearlas por completo le impedirá iniciar sesión en la Plataforma.
      </p>

      <h2>5. Contacto</h2>
      <p>
        Para cualquier consulta, escríbanos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPageShell>
  );
}
