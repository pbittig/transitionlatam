import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getDashboardStats, listProjects } from "@/lib/data-access/projects";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Página de depuración temporal para la Fase 1 (ver docs/10-roadmap-mvp.md) —
  // no pasa por autenticación ni por los límites anti-scraping de la Fase 2/09-seguridad.md,
  // así que no debe existir en producción. Se reemplaza por el dashboard público real.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { page: pageParam } = await searchParams;
  const page = Number(pageParam ?? "1") || 1;

  const client = await createSupabaseServerClient();
  const [stats, list] = await Promise.all([
    getDashboardStats(client),
    listProjects(client, {}, page, 50),
  ]);

  const totalPages = Math.max(1, Math.ceil(list.totalCount / list.pageSize));

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <p style={{ background: "#fffbcc", padding: "0.5rem 1rem", marginBottom: "1.5rem" }}>
        Vista previa interna — sin diseño final, solo para revisar datos de la ingesta en curso.
      </p>

      <h1>Transition LATAM — Vista previa (Chile)</h1>

      <section style={{ display: "flex", gap: "2rem", margin: "1.5rem 0" }}>
        <div><strong>{stats.totalProjects}</strong> proyectos</div>
        <div><strong>{stats.totalCapacityMw.toFixed(1)}</strong> MW</div>
        <div><strong>{stats.totalCapacityMwh.toFixed(1)}</strong> MWh</div>
      </section>

      <h2>Por tecnología</h2>
      <ul>
        {stats.byTechnology
          .sort((a, b) => b.count - a.count)
          .map((t) => (
            <li key={t.technology}>
              {t.technology}: {t.count} proyectos ({t.capacityMw.toFixed(1)} MW)
            </li>
          ))}
      </ul>

      <h2>Por región</h2>
      <ul>
        {stats.byRegion
          .sort((a, b) => b.count - a.count)
          .map((r) => (
            <li key={r.region}>
              {r.region}: {r.count} proyectos
            </li>
          ))}
      </ul>

      <h2>
        Proyectos (página {list.page} de {totalPages})
      </h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {[
              "Nombre",
              "Empresa",
              "Tecnología",
              "Región",
              "Comuna",
              "Inyección/Retiro MW",
              "Generación MW",
              "Almacenamiento MW",
              "Horas",
              "Energía MWh",
              "Estado",
              "Fecha conexión",
            ].map((h) => (
              <th key={h} style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "left" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.items.map((p) => (
            <tr key={p.id}>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.name}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.developerCompany ?? "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
                {p.technology ?? "-"}
                {p.includesStorage ? " + BESS" : ""}
              </td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.region ?? "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.comuna ?? "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
                {p.netInjectionMw ?? p.netWithdrawalMw ?? "-"}
              </td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.generationCapacityMw ?? "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.storageCapacityMw ?? "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.storageHours ?? "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.capacityMwh ?? "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.status ?? "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{p.estimatedConnectionDate ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        {page > 1 && <a href={`?page=${page - 1}`}>← Anterior</a>}
        {page < totalPages && <a href={`?page=${page + 1}`}>Siguiente →</a>}
      </div>
    </main>
  );
}
