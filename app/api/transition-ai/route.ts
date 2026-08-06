export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({ error: "Servicio no disponible." }, { status: 404 });
}
