/**
 * Coordenadas de la capital regional, usadas como proxy aproximado de región
 * cuando el proyecto no tiene ubicación precisa (lat/lng real). Deliberadamente
 * NO se usa esto para representar la ubicación exacta de un proyecto individual
 * — solo para agregados por región (burbujas), donde la imprecisión de escala
 * regional no induce a error. Ver docs/04-modelo-datos.md §4.3 (no presentar
 * una estimación como un hecho verificado).
 */
export const CHILE_REGION_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  "Arica y Parinacota": { lat: -18.4783, lng: -70.3126 },
  "Tarapacá": { lat: -20.2141, lng: -70.1522 },
  "Antofagasta": { lat: -23.6509, lng: -70.3975 },
  "Atacama": { lat: -27.3668, lng: -70.3323 },
  "Coquimbo": { lat: -29.9027, lng: -71.2519 },
  "Valparaíso": { lat: -33.0472, lng: -71.6127 },
  "Metropolitana de Santiago": { lat: -33.4489, lng: -70.6693 },
  "Libertador General Bernardo O'Higgins": { lat: -34.1708, lng: -70.7444 },
  "Maule": { lat: -35.4264, lng: -71.6554 },
  "Ñuble": { lat: -36.6066, lng: -72.1034 },
  "Biobío": { lat: -36.8201, lng: -73.0444 },
  "La Araucanía": { lat: -38.7359, lng: -72.5904 },
  "Los Ríos": { lat: -39.8142, lng: -73.2459 },
  "Los Lagos": { lat: -41.4693, lng: -72.9424 },
  "Aysén": { lat: -45.5712, lng: -72.0685 },
  "Magallanes y de la Antártica Chilena": { lat: -53.1638, lng: -70.9171 },
};
