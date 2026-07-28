import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getLastSyncTimestamp } from "@/lib/data-access/powerPlants";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getAppSetting, getWatchlistEvents } from "@/lib/data-access/watchlist";
import { isAdmin } from "@/lib/auth/session";
import { Sidebar } from "./components/Sidebar";
import { PremiumAiBar } from "./components/PremiumAiBar";
import { FollowNotifications } from "./components/FollowNotifications";
import { getAppLocale } from "@/lib/i18n";

function getRemainingTrialDays(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const client = await createSupabaseServerClient();
  const [lastSync, admin, userProfile, locale] = await Promise.all([
    getLastSyncTimestamp(client),
    isAdmin(),
    getCurrentUserProfile(client),
    getAppLocale(),
  ]);
  const remainingTrialDays = getRemainingTrialDays(userProfile?.trialEndsAt);
  const followEnabled = admin || userProfile?.planCode === "lite" || userProfile?.planCode === "premium";
  const followEvents = followEnabled
      ? await (async () => {
        const serviceClient = createSupabaseServiceClient();
        const [includeNewProjects, notificationsEnabled] = await Promise.all([
          getAppSetting(serviceClient, "notify_new_projects"),
          getAppSetting(serviceClient, "follow_notifications_enabled", true),
        ]);
        return notificationsEnabled ? getWatchlistEvents(serviceClient, 12, includeNewProjects) : [];
      })()
    : [];

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,var(--brand-surface)_0px,#fff_260px)] dark:bg-[linear-gradient(180deg,#102624_0px,#171717_260px)]">
      <Sidebar lastSync={lastSync} isAdmin={admin} userProfile={userProfile} remainingTrialDays={remainingTrialDays} locale={locale} />
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
      <FollowNotifications events={followEvents} />
      <PremiumAiBar enabled={admin || userProfile?.planCode === "premium"} />
    </div>
  );
}
