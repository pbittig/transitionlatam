// Numeración romana oficial de las regiones de Chile (DFL — la nomenclatura
// histórica, sigue vigente junto al nombre). RM y las regiones creadas después
// de la reforma de 1974 no siguen el orden geográfico estricto (XIV, XV, XVI).
const REGION_ROMAN_NUMERAL: Record<string, string> = {
  "Arica y Parinacota": "XV",
  Tarapacá: "I",
  Antofagasta: "II",
  Atacama: "III",
  Coquimbo: "IV",
  Valparaíso: "V",
  "Metropolitana de Santiago": "RM",
  "Libertador General Bernardo O'Higgins": "VI",
  Maule: "VII",
  Ñuble: "XVI",
  Biobío: "VIII",
  "La Araucanía": "IX",
  "Los Ríos": "XIV",
  "Los Lagos": "X",
  Aysén: "XI",
  "Magallanes y de la Antártica Chilena": "XII",
};

export function regionToRomanNumeral(region: string | null): string | null {
  if (!region) return null;
  return REGION_ROMAN_NUMERAL[region] ?? region;
}
