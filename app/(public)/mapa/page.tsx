import { redirect } from "next/navigation";

// El mapa se integró dentro de Proyectos Esperados y Proyectos Actuales — este alias evita enlaces rotos.
export default function MapaRedirect() {
  redirect("/proyectos");
}
