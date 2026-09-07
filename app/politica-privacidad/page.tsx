import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "../components/LegalPageShell";
import { TERMS_VERSION_LABEL } from "@/lib/legal/termsVersion";

export const metadata: Metadata = {
  title: "Política de Privacidad — Transition LATAM",
  description: "Cómo Transition LATAM recopila, usa y protege los datos personales.",
};

const CONTACT_EMAIL = "patrick.bittig@onixcg.com";

export default function PoliticaPrivacidadPage() {
  return (
    <LegalPageShell title="Política de Privacidad y Tratamiento de Datos Personales" updatedAt={TERMS_VERSION_LABEL}>
      <h2>1. Quiénes somos</h2>
      <p>
        Transition LATAM (en adelante, “la Plataforma”) es una plataforma de inteligencia de mercado para la
        transición energética en Latinoamérica, operada por <strong>ONIX Consulting Group</strong> (en adelante,
        “ONIX”, “nosotros” o “el Responsable del Tratamiento”).
      </p>
      <p>
        Para efectos de esta política, ONIX es el Responsable del Tratamiento de los datos personales descritos a
        continuación, en los términos de la Ley N° 19.628 sobre Protección de la Vida Privada y de la Ley N° 21.719
        que la moderniza y crea la Agencia de Protección de Datos Personales de Chile (en adelante, conjuntamente,
        “la Ley”).
      </p>

      <h2>2. Dos grupos de personas distintos</h2>
      <p>
        La Plataforma trata datos personales de dos grupos de personas muy distintos, con orígenes y derechos
        distintos:
      </p>
      <ul className="list-disc pl-5 [&>li]:mt-1.5">
        <li>
          <strong>(a) Usuarios registrados</strong>: personas que crean una cuenta para consultar información de
          mercado. Estos datos se obtienen directamente de la persona, con su conocimiento, al registrarse.
        </li>
        <li>
          <strong>(b) Terceros mencionados en la información de mercado</strong>: personas naturales que aparecen en
          los datos que consolidamos —típicamente representantes legales, coordinadores de proyecto, o
          controladores de sociedades vehículo de proyectos energéticos— porque su nombre, RUT, correo o teléfono
          constan en registros públicos o regulatorios (Servicio de Impuestos Internos, Comisión para el Mercado
          Financiero, Diario Oficial, y los formularios de solicitud de conexión del Coordinador Eléctrico
          Nacional). <strong>Estas personas normalmente no son usuarias de la Plataforma</strong> ni se registraron
          en ella.
        </li>
      </ul>
      <p>
        Si usted pertenece al grupo (b) y quiere saber qué información tenemos sobre usted o ejercer sus derechos,
        vaya directamente a la sección 8.
      </p>

      <h2>3. Datos que recopilamos directamente de nuestros usuarios registrados</h2>
      <p>
        Al crear una cuenta, recopilamos: nombre completo, correo electrónico corporativo, nombre de la empresa,
        cargo, teléfono móvil, tipo de organización, país, e idioma preferido. Si sube una foto de perfil, también la
        almacenamos. Mientras usa la Plataforma, generamos y almacenamos registros de las páginas/proyectos que
        visita, un registro técnico de sus consultas al asistente de inteligencia artificial (sin el texto de la
        pregunta, ver sección 4), filtros de búsqueda aplicados, y las solicitudes de servicio o contacto comercial
        que usted nos envía voluntariamente.
      </p>
      <p>
        <strong>No solicitamos ni almacenamos datos de pago.</strong> La contratación de planes pagados se gestiona
        mediante un contrato de servicio y un medio de pago externo, coordinados directamente por el equipo
        comercial de ONIX.
      </p>

      <h2>4. Cómo usamos estos datos</h2>
      <p>
        Tratamos estos datos para: (a) crear y administrar su cuenta y su sesión; (b) prestarle el Servicio conforme
        a su plan; (c) comunicarnos con usted sobre su cuenta o en respuesta a solicitudes suyas; (d) evaluar el
        interés comercial en nuestros servicios y contactarlo con fines comerciales relacionados con ONIX; (e)
        mantener la seguridad de la Plataforma y prevenir el uso abusivo o la extracción automatizada de datos; y (f)
        cumplir obligaciones legales.
      </p>
      <p>
        El asistente de inteligencia artificial de la Plataforma no recibe su nombre, correo ni datos de su empresa
        como parte del contexto que se envía a los proveedores de modelos de lenguaje: solo se le entregan los datos
        de mercado necesarios para responder su consulta. Del historial de uso guardamos un registro técnico con
        fines de auditoría (qué herramienta se usó, cuándo, y un valor de verificación de la consulta, no su
        contenido en texto plano).
      </p>

      <h2>5. Cookies y almacenamiento local</h2>
      <p>
        Usamos únicamente las cookies estrictamente necesarias para mantener su sesión iniciada, y dos claves de
        almacenamiento local en su navegador para recordar qué avisos ya vio. No usamos cookies de publicidad,
        seguimiento entre sitios ni herramientas de analítica de terceros. El detalle completo está en nuestra{" "}
        <Link href="/politica-cookies">Política de Cookies</Link>.
      </p>

      <h2>6. A quién comunicamos datos personales</h2>
      <p>
        Para operar la Plataforma, compartimos datos personales con proveedores que actúan como encargados de
        tratamiento bajo nuestras instrucciones, únicamente para los fines aquí descritos. Ninguno está autorizado a
        usar los datos para fines propios ajenos a la prestación de su servicio a ONIX.
      </p>
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Rol</th>
            <th>Datos que puede procesar</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Base de datos, autenticación, almacenamiento de archivos</td>
            <td>Todos los datos descritos en esta política</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Alojamiento de la aplicación web</td>
            <td>Metadatos técnicos de las solicitudes</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Envío de correos transaccionales</td>
            <td>Nombre, correo, contenido del correo</td>
          </tr>
          <tr>
            <td>NVIDIA (NIM / Nemotron)</td>
            <td>Extracción automatizada de contactos desde formularios oficiales</td>
            <td>Nombre, correo y teléfono de representantes legales y coordinadores de proyecto, si constan en el documento</td>
          </tr>
          <tr>
            <td>OpenAI</td>
            <td>Motor del asistente de inteligencia artificial</td>
            <td>Consultas sobre datos de mercado (sin datos de identificación del usuario)</td>
          </tr>
          <tr>
            <td>Moonshot AI (Kimi)</td>
            <td>Proveedor alternativo de inteligencia artificial en ciertos flujos internos</td>
            <td>Igual que el anterior, según el flujo activo</td>
          </tr>
          <tr>
            <td>dequienes.cl</td>
            <td>Datos de estructura societaria desde registros públicos chilenos</td>
            <td>Nombre y RUT de personas naturales y jurídicas</td>
          </tr>
        </tbody>
      </table>
      <p>
        Algunos de estos proveedores procesan datos fuera de Chile, incluyendo en Estados Unidos y, en el caso de
        Moonshot AI, en la República Popular China. ONIX adopta las salvaguardas contractuales estándar disponibles
        con cada proveedor para estas transferencias. No vendemos datos personales a terceros con fines de marketing
        de terceros, bajo ninguna circunstancia.
      </p>

      <h2>7. Datos de terceros obtenidos de fuentes públicas</h2>
      <p>
        Esta sección aplica a las personas descritas en la sección 2, grupo (b). Tratamos: nombre y RUT de personas
        naturales controladoras de sociedades vehículo de proyectos energéticos, obtenidos a través de un proveedor
        especializado (dequienes.cl) que consolida registros del Servicio de Impuestos Internos, la Comisión para el
        Mercado Financiero y el Diario Oficial; y nombre, correo y teléfono de representantes legales y
        coordinadores de proyecto, obtenidos de los formularios oficiales de solicitud de conexión que los propios
        titulares de los proyectos presentan ante el Coordinador Eléctrico Nacional, organismo sujeto a un mandato
        legal de transparencia del sector eléctrico chileno.
      </p>
      <p>
        Tratamos estos datos, sin haberlos recabado directamente del titular, porque la Ley permite el tratamiento
        de datos que provienen de una fuente de acceso público, y estos registros constituyen ese tipo de fuente. El
        propósito de ONIX al consolidarlos es permitir que actores del sector energético identifiquen a los
        interlocutores relevantes de un proyecto.
      </p>
      <p>
        El nombre y RUT de controladores societarios se muestra en el mapa de propiedad de cada proyecto. El nombre,
        correo y teléfono de representantes legales y coordinadores de proyecto <strong>solo se revela a usuarios
        autenticados en un plan de pago</strong>, mediante una acción explícita (“Ver contacto”); esta acción queda
        registrada internamente. Todo usuario que revela un contacto se obliga, por nuestros{" "}
        <Link href="/terminos-y-condiciones">Términos y Condiciones</Link>, a usarlo únicamente con fines
        profesionales legítimos, a no reenviarlo ni republicarlo masivamente, y a cumplir su propia normativa de
        protección de datos y de comunicaciones comerciales.
      </p>

      <h2>8. Sus derechos</h2>
      <p>
        Conforme a la Ley, usted tiene derecho a acceder a sus datos personales, rectificarlos si son erróneos,
        solicitar su cancelación o supresión, oponerse a un tratamiento específico, y a la portabilidad de los datos
        que usted nos entregó. Esto aplica tanto si usted es usuario registrado como si sus datos aparecen en la
        Plataforma sin que usted lo sea (por ejemplo, como representante legal o controlador societario mencionado
        en un proyecto).
      </p>
      <p>
        Para ejercer cualquiera de estos derechos, escríbanos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, identificándose y describiendo su solicitud.
        Responderemos dentro del plazo que establece la Ley. Si usted no es usuario de la Plataforma, puede además
        solicitar que dejemos de mostrar su información, sin perjuicio de que el dato de origen siga existiendo en
        su fuente pública original, sobre la cual no tenemos control.
      </p>

      <h2>9. Cuánto tiempo conservamos los datos</h2>
      <p>
        Conservamos los datos mientras su cuenta o el proyecto asociado permanezcan activos, o hasta que usted ejerza
        su derecho de cancelación conforme a la sección 8.
      </p>

      <h2>10. Seguridad de la información</h2>
      <p>
        Aplicamos medidas técnicas y organizativas para proteger los datos personales, incluyendo control de acceso
        según el plan y el rol del usuario, cifrado de las comunicaciones, límites automáticos a la extracción masiva
        de datos, y registro de auditoría de los accesos a información sensible. Ninguna medida de seguridad es
        infalible; ante un incidente que comprometa datos personales, seguiremos el procedimiento de notificación
        que exige la Ley.
      </p>

      <h2>11. Menores de edad</h2>
      <p>
        La Plataforma está dirigida a profesionales del sector energético y empresas. No está dirigida a menores de
        18 años y no recolectamos deliberadamente datos de menores.
      </p>

      <h2>12. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política para reflejar cambios en el Servicio o en la normativa aplicable.
        Publicaremos la versión vigente en esta misma dirección con su fecha de actualización, y le notificaremos
        los cambios sustanciales por un medio razonable.
      </p>

      <h2>13. Ley aplicable y contacto</h2>
      <p>
        Esta política se rige por las leyes de la República de Chile. Para cualquier consulta, escríbanos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPageShell>
  );
}
