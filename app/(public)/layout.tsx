import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getLastSyncTimestamp } from "@/lib/data-access/powerPlants";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { isAdmin } from "@/lib/auth/session";
import { Sidebar } from "./components/Sidebar";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const client = await createSupabaseServerClient();
  const [lastSync, admin, userProfile] = await Promise.all([
    getLastSyncTimestamp(client),
    isAdmin(),
    getCurrentUserProfile(client),
  ]);

  return (
    <div className="min-h-full bg-white dark:bg-neutral-900">
      <Sidebar lastSync={lastSync} isAdmin={admin} userProfile={userProfile} />
      <div className="flex min-h-full flex-col pl-16 md:pl-64 print:pl-0">
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-6 pb-10 print:px-0 print:py-0">{children}</main>
        <footer className="border-t border-neutral-100 py-8 text-center text-sm text-neutral-500 print:hidden dark:border-neutral-800 dark:text-neutral-400">
          Transition LATAM — una plataforma de{" "}
          <a
            href="https://www.onixcg.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            ONIX Consulting Group
          </a>
        </footer>
      </div>
    </div>
  );
}
