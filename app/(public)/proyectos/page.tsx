import { redirect } from "next/navigation";

// El listado de proyectos se renombró y trasladó a Proyectos Esperados — este
// alias evita enlaces rotos. Las fichas individuales (/proyectos/[id]) no cambian.
export default function ProyectosRedirect() {
  redirect("/proyectos-esperados");
}
