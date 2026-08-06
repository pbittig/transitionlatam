/**
 * Formato único de nombre/correo de contacto para mostrar en pantalla — dato
 * real, sin enmascarar (ver maskContact.ts para la versión enmascarada de
 * planes Free/Lite). Solo normaliza presentación (Title Case, minúsculas);
 * no toca lo guardado en la base ni intenta deduplicar personas.
 */

const LOWERCASE_PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e", "van", "von", "di"]);

export function formatPersonName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const words = fullName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words
    .map((word, i) => (i > 0 && LOWERCASE_PARTICLES.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function formatEmailForDisplay(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}
