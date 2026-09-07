import "server-only";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getAppSetting } from "@/lib/data-access/watchlist";

/**
 * Modo mantenimiento: corta el ingreso de clientes sin tocar a los admins.
 *
 * Vive en `app_setting` y no en una variable de entorno para que se pueda
 * prender y apagar desde /admin sin un deploy — que es justo lo que uno
 * necesita cuando el motivo para prenderlo es que se está por aplicar algo
 * grande a la base.
 *
 * Los administradores entran por /admin/acceso, una ruta distinta que no
 * consulta esto, así que el sistema queda operable mientras los clientes ven
 * el aviso.
 */
export const MAINTENANCE_SETTING_KEY = "maintenance_mode";

export async function isMaintenanceMode(): Promise<boolean> {
  // El flag vive en la base compartida, así que prenderlo para los clientes
  // también alcanzaría al `next dev` de la máquina local — que es justamente
  // donde uno revisa cambios MIENTRAS producción está en mantenimiento. El
  // candado es para el sitio publicado; en desarrollo no aplica.
  if (process.env.NODE_ENV === "development") return false;
  try {
    return await getAppSetting(createSupabaseServiceClient(), MAINTENANCE_SETTING_KEY, false);
  } catch {
    // Si la consulta falla, no se cierra el ingreso: dejar entrar a los
    // clientes ante un problema de lectura es preferible a bloquear a todo el
    // mundo por un error transitorio de la base.
    return false;
  }
}
