import type { NextConfig } from "next";

// Cabeceras defensivas — hallazgo "Medio" de docs/security-audit-2026-07-29.md.
//
// La CSP va en Report-Only a propósito, siguiendo la recomendación de esa misma
// auditoría: primero se mide qué rompería, recién después se hace bloqueante.
// Mientras esté en Report-Only NO bloquea nada; las violaciones aparecen en la
// consola del navegador. Para activarla de verdad, cambiar la key por
// "Content-Security-Policy" — pero antes hay que revisar la consola en /mapa,
// /crm y la ficha de proyecto, que son las páginas con más orígenes externos.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/** El mapa usa los tiles de demostración de MapLibre (ver MapView.tsx y ADR-006). */
const MAP_TILES = "https://demotiles.maplibre.org";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `img-src 'self' data: blob: ${MAP_TILES}`,
  "style-src 'self' 'unsafe-inline'",
  // Next inyecta scripts inline para la hidratación. Una CSP con nonce es un
  // proyecto aparte, no un ajuste de configuración.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "font-src 'self' data:",
  // MapLibre crea sus web workers a partir de blobs.
  "worker-src 'self' blob:",
  [
    "connect-src 'self'",
    supabaseOrigin,
    supabaseOrigin.replace(/^https:/, "wss:"),
    MAP_TILES,
  ]
    .filter(Boolean)
    .join(" "),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    viewTransition: true,
  },
  // pdf-parse -> pdfjs-dist -> @napi-rs/canvas is a native binary addon. Left
  // bundled, Turbopack's static file tracing misses the platform-specific
  // .node binary in the serverless output (worked locally, "DOMMatrix is not
  // defined" in production — @napi-rs/canvas silently failed to load). Marking
  // these external makes them resolve via normal node_modules requires at
  // runtime instead, which @vercel/nft traces correctly.
  // @firecrawl/pdf-inspector (parser posicional de Formularios PDF) cae en la
  // misma categoría: trae un asset no-ECMAScript que Turbopack no puede colocar
  // en un chunk ESM ("non-ecmascript placeable asset"), y el build falla.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "@firecrawl/pdf-inspector"],
  async redirects() {
    return [
      { source: "/matriz", destination: "/operacion", permanent: true },
      { source: "/empresas", destination: "/propietarios", permanent: true },
      { source: "/monitoreo", destination: "/seguimiento", permanent: true },
      { source: "/requerimientos", destination: "/servicios", permanent: true },
      { source: "/servicios-adicionales", destination: "/servicios", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/operacion", destination: "/mercado" },
      { source: "/propietarios", destination: "/mapa-stakeholder" },
      { source: "/seguimiento", destination: "/alertas" },
      { source: "/servicios-adicionales", destination: "/requerimientos" },
      { source: "/servicios", destination: "/requerimientos" },
      { source: "/projects", destination: "/proyectos" },
      { source: "/operations", destination: "/mercado" },
      { source: "/owners", destination: "/mapa-stakeholder" },
      { source: "/tracking", destination: "/alertas" },
      { source: "/dynamic-analysis", destination: "/analisis-dinamico" },
      { source: "/services", destination: "/requerimientos" },
      { source: "/plans", destination: "/planes" },
      { source: "/subscribe-prime", destination: "/contratar-prime" },
    ];
  },
};

export default nextConfig;
