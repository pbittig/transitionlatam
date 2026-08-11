import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
