import type { Entitlements } from "./resolve";

export function hasFeature(entitlements: Entitlements, featureCode: string): boolean {
  return entitlements.features.has(featureCode);
}

export function getFeatureLimit(
  entitlements: Entitlements,
  featureCode: string,
  limitKey: string,
): unknown {
  return entitlements.features.get(featureCode)?.[limitKey];
}

export class EntitlementError extends Error {
  constructor(featureCode: string) {
    super(`El plan actual no incluye la funcionalidad requerida: ${featureCode}`);
    this.name = "EntitlementError";
  }
}

export function requireFeature(entitlements: Entitlements, featureCode: string): void {
  if (!hasFeature(entitlements, featureCode)) {
    throw new EntitlementError(featureCode);
  }
}
