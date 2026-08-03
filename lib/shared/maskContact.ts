/**
 * Enmascara nombre/correo de un contacto para mostrar como anticipo antes de
 * revelar (plan Free/Lite). Largo fijo, no proporcional al dato real — si el
 * número de asteriscos reflejara el largo real del nombre/correo, alguien
 * podría inferir de quién se trata solo por esa longitud.
 */
const NAME_MASK_LENGTH = 6;
const DOMAIN_MASK_LENGTH = 4;
const TLD_MASK_LENGTH = 2;

export function maskName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + "*".repeat(NAME_MASK_LENGTH))
    .join(" ");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local) return "*".repeat(NAME_MASK_LENGTH);
  const maskedLocal = local[0]!.toUpperCase() + "*".repeat(NAME_MASK_LENGTH);
  if (!domain) return maskedLocal;

  const lastDotIndex = domain.lastIndexOf(".");
  const tld = lastDotIndex >= 0 ? domain.slice(lastDotIndex + 1) : "";
  const maskedDomain = "*".repeat(DOMAIN_MASK_LENGTH);
  const maskedTld = tld ? "*".repeat(TLD_MASK_LENGTH) + tld.slice(-1) : "";
  return `${maskedLocal}@${maskedDomain}${maskedTld ? "." + maskedTld : ""}`;
}
