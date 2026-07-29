// Regulador compartido por todos los workers de pre-verificación. El límite de
// NVIDIA NIM se aplica a la API key completa, no a cada promesa individual:
// sin una compuerta global, tres workers sincronizan sus reintentos y vuelven a
// golpear el mismo límite 429 al mismo tiempo.
const GLM_MIN_INTERVAL_MS = 2_200;

let gate: Promise<void> = Promise.resolve();
let nextAvailableAt = 0;

export function waitForPreverificationGlmSlot(): Promise<void> {
  const slot = gate.then(async () => {
    const waitMs = Math.max(0, nextAvailableAt - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    nextAvailableAt = Date.now() + GLM_MIN_INTERVAL_MS;
  });
  gate = slot.catch(() => {});
  return slot;
}
