import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
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
