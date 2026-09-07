import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "../components/LegalPageShell";
import { TERMS_VERSION_LABEL } from "@/lib/legal/termsVersion";

export const metadata: Metadata = {
  title: "Términos y Condiciones — Transition LATAM",
  description: "Términos y condiciones de uso de la plataforma Transition LATAM.",
};

const CONTACT_EMAIL = "patrick.bittig@onixcg.com";

export default function TerminosPage() {
  return (
    <LegalPageShell title="Términos y Condiciones de Uso" updatedAt={TERMS_VERSION_LABEL}>
      <p>
        Estos Términos y Condiciones (“los Términos”) rigen el acceso y uso de Transition LATAM
        (transitionlatam.com y sus subdominios, “la Plataforma”), operada por <strong>ONIX Consulting Group</strong> (“ONIX”,
        “nosotros”). Al crear una cuenta o usar la Plataforma, usted acepta estos Términos y nuestra{" "}
        <Link href="/politica-privacidad">Política de Privacidad</Link>. Si actúa en representación de una empresa,
        declara tener autorización para obligarla a estos Términos.
      </p>
      <p>Si no está de acuerdo con estos Términos, no debe usar la Plataforma.</p>

      <h2>1. Qué es la Plataforma</h2>
      <p>
        Transition LATAM es una plataforma de inteligencia de mercado que consolida, procesa y presenta información
        sobre proyectos de energía en Latinoamérica, obtenida principalmente de fuentes públicas y regulatorias
        (Coordinador Eléctrico Nacional, Comisión Nacional de Energía, Servicio de Evaluación Ambiental, Servicio de
        Impuestos Internos, Diario Oficial, entre otras), complementada con análisis, categorización e inferencias
        generadas por ONIX y por herramientas de inteligencia artificial.
      </p>
      <p>
        <strong>Naturaleza referencial de la información.</strong> Los datos de la Plataforma se elaboran a partir de
        fuentes públicas y tienen carácter referencial. Cuando un dato es una inferencia o estimación de ONIX (por
        ejemplo, un porcentaje de avance de un trámite, una fase de madurez estimada, o una categorización asistida
        por inteligencia artificial) se identifica como tal dentro de la propia interfaz. Ningún dato de la
        Plataforma reemplaza la verificación directa ante el organismo competente, y usted es responsable de validar
        la información antes de tomar decisiones comerciales, de inversión o de cualquier otra naturaleza basadas en
        ella.
      </p>

      <h2>2. Cuentas de usuario</h2>
      <p>
        Para usar la mayoría de las funciones de la Plataforma, debe crear una cuenta con un correo corporativo
        válido. Usted se obliga a: (a) proporcionar información veraz, completa y actualizada; (b) mantener la
        confidencialidad de sus credenciales; (c) notificarnos de inmediato ante cualquier uso no autorizado de su
        cuenta; y (d) no compartir su cuenta con terceros ni crear cuentas en nombre de otra persona sin autorización.
      </p>
      <p>
        ONIX puede solicitar verificación adicional, rechazar un registro, o suspender o deshabilitar una cuenta que
        incumpla estos Términos, a su sola discreción y sin perjuicio de otras acciones que correspondan.
      </p>

      <h2>3. Planes, prueba gratuita y contratación de planes pagados</h2>
      <p>
        La Plataforma ofrece un plan gratuito y un plan Premium (“Prime”). El registro de autoservicio incluye un
        período de prueba de 14 días. La activación de un plan pagado se coordina directamente con el equipo
        comercial de ONIX y se formaliza mediante un contrato de servicio separado; <strong>la Plataforma no procesa
        pagos ni almacena medios de pago</strong>. ONIX puede modificar el contenido, precio o condiciones de los
        planes en cualquier momento, dando aviso razonable a los usuarios afectados con contrato vigente.
      </p>

      <h2>4. Uso aceptable</h2>
      <p>Al usar la Plataforma, usted se obliga a <strong>no</strong>:</p>
      <ul className="list-disc pl-5 [&>li]:mt-1.5">
        <li>
          Extraer, copiar o reproducir de forma automatizada (scraping, bots, ingeniería inversa de la API, o
          cualquier medio equivalente) el contenido, la estructura de datos o los resultados de la Plataforma, salvo
          autorización expresa y escrita de ONIX;
        </li>
        <li>
          Intentar eludir los límites técnicos de su plan (límites de consultas, paginación, campos restringidos) o
          los mecanismos de control de acceso;
        </li>
        <li>
          Revender, redistribuir masivamente, sublicenciar o poner a disposición de terceros no autorizados el
          contenido de la Plataforma o los datos de contacto revelados a través de ella;
        </li>
        <li>
          Usar los datos de contacto de personas naturales que la Plataforma revela (representantes legales,
          coordinadores de proyecto) para envío masivo de comunicaciones comerciales no solicitadas, para fines
          ajenos al análisis y desarrollo de negocios en el sector energético, o de cualquier forma que infrinja la
          normativa de protección de datos personales aplicable a usted como usuario que recibe esa información;
        </li>
        <li>Usar la Plataforma o sus datos para entrenar, alimentar o mejorar un producto o servicio competidor;</li>
        <li>Interferir con la operación, seguridad o disponibilidad de la Plataforma.</li>
      </ul>
      <p>
        El incumplimiento de esta sección constituye una causal de suspensión o terminación inmediata de su cuenta,
        sin perjuicio de las acciones legales que correspondan.
      </p>

      <h2>5. Datos de terceros mostrados en la Plataforma — su responsabilidad al usarlos</h2>
      <p>
        La Plataforma consolida y, en el caso de usuarios Premium, revela datos de contacto de personas naturales
        (nombre, correo, teléfono) obtenidos de fuentes públicas y regulatorias, conforme se describe en nuestra{" "}
        <Link href="/politica-privacidad">Política de Privacidad</Link>. <strong>Al revelar y usar esta información,
        usted actúa como responsable independiente respecto de ese tratamiento</strong> y se obliga a cumplir la
        normativa de protección de datos personales que le sea aplicable, incluyendo atender directamente cualquier
        solicitud de rectificación, oposición o exclusión que el titular del dato le formule. Usted mantendrá
        indemne a ONIX frente a cualquier reclamo, multa o daño derivado de un uso de esos datos que incumpla esta
        sección o la normativa aplicable.
      </p>

      <h2>6. Propiedad intelectual</h2>
      <p>
        La Plataforma, su diseño, estructura de bases de datos, análisis, algoritmos y marcas son propiedad de ONIX o
        de sus licenciantes, y están protegidos por la normativa de propiedad intelectual e industrial aplicable.
        Estos Términos no le otorgan ninguna licencia sobre ellos más allá del uso personal y profesional de la
        Plataforma conforme a su plan.
      </p>
      <p>
        Los datos de origen público que la Plataforma consolida siguen perteneciendo a sus fuentes originales; ONIX
        no reclama propiedad sobre el hecho subyacente (por ejemplo, la existencia de un proyecto o la identidad de
        su titular), sino sobre la estructura, análisis y presentación que agrega a esos datos.
      </p>

      <h2>7. Exactitud de la información y exclusión de garantías</h2>
      <p>
        La Plataforma se provee “tal cual” y “según disponibilidad”. ONIX no garantiza que la información sea
        exacta, completa, actualizada o libre de errores, ni que el Servicio esté disponible de forma
        ininterrumpida. En la medida permitida por la ley, ONIX excluye toda garantía implícita de comerciabilidad,
        idoneidad para un propósito particular o no infracción.
      </p>
      <p>
        Nada en la Plataforma constituye asesoría legal, financiera, de inversión o regulatoria. Cualquier decisión
        que usted tome basada en la información de la Plataforma es de su exclusiva responsabilidad.
      </p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>
        En la medida permitida por la ley chilena, la responsabilidad total de ONIX frente a usted por cualquier
        reclamo relacionado con estos Términos o con el Servicio se limita al monto efectivamente pagado por usted a
        ONIX en los 12 meses anteriores al hecho que origina el reclamo. ONIX no será responsable por daños
        indirectos, lucro cesante, pérdida de datos o de oportunidades comerciales, salvo en los casos en que la ley
        no permita limitar dicha responsabilidad.
      </p>

      <h2>9. Suspensión y terminación</h2>
      <p>
        ONIX puede suspender o terminar su acceso a la Plataforma, con o sin previo aviso, si: incumple estos
        Términos; su cuenta representa un riesgo de seguridad o de extracción abusiva de datos; o por decisión
        comercial de discontinuar el Servicio, en cuyo caso se dará aviso razonable a los usuarios con plan pagado
        vigente. Usted puede dejar de usar la Plataforma en cualquier momento; para solicitar la eliminación de su
        cuenta y sus datos, escríbanos conforme a la sección 12.
      </p>

      <h2>10. Modificaciones a estos Términos</h2>
      <p>
        Podemos actualizar estos Términos para reflejar cambios en el Servicio o en la normativa aplicable. La
        versión vigente siempre estará disponible en esta dirección, con su fecha de actualización. El uso
        continuado de la Plataforma después de una actualización constituye aceptación de los nuevos Términos; si el
        cambio es sustancial, se lo notificaremos por un medio razonable.
      </p>

      <h2>11. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos se rigen por las leyes de la República de Chile. Para cualquier controversia, las partes se
        someten a la jurisdicción de los tribunales ordinarios de justicia de Chile.
      </p>

      <h2>12. Contacto</h2>
      <p>
        Para cualquier consulta sobre estos Términos, escríbanos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPageShell>
  );
}
