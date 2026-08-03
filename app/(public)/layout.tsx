import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getAppSetting, getWatchlistEvents, NEW_PROJECT_ALERT_CATEGORIES } from "@/lib/data-access/watchlist";
import { isAdmin } from "@/lib/auth/session";
import { Sidebar } from "./components/Sidebar";
import { PremiumAiBar } from "./components/PremiumAiBar";
import { FollowNotifications } from "./components/FollowNotifications";
import { getAppLocale } from "@/lib/i18n";
import { getAiChatMemory } from "@/lib/data-access/aiChat";
import { MobileNavigation } from "./components/MobileNavigation";

function getRemainingTrialDays(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const client = await createSupabaseServerClient();
  const [admin, userProfile, locale] = await Promise.all([
    isAdmin(),
    getCurrentUserProfile(client),
    getAppLocale(),
  ]);
  const remainingTrialDays = getRemainingTrialDays(userProfile?.trialEndsAt);
  const followEnabled = admin || userProfile?.planCode === "lite" || userProfile?.planCode === "premium";
  const followEvents = followEnabled
      ? await (async () => {
        const serviceClient = createSupabaseServiceClient();
        const [notificationsEnabled, ...categorySettings] = await Promise.all([
          getAppSetting(serviceClient, "follow_notifications_enabled", true),
          ...NEW_PROJECT_ALERT_CATEGORIES.map((category) => getAppSetting(serviceClient, `notify_new_${category}`, true)),
        ]);
        const categories = NEW_PROJECT_ALERT_CATEGORIES.filter((_, index) => categorySettings[index]);
        return notificationsEnabled ? getWatchlistEvents(serviceClient, 12, categories.length > 0, categories) : [];
      })()
    : [];
  const aiEnabled = admin || userProfile?.planCode === "premium";
  const aiMemory = aiEnabled
    ? await getAiChatMemory(
        createSupabaseServiceClient(),
        userProfile ? { profileId: userProfile.id } : { admin: true },
      )
    : [];

  return (
    <div className="min-h-full bg-white">
      <Sidebar isAdmin={admin} userProfile={userProfile} remainingTrialDays={remainingTrialDays} locale={locale} />
      <MobileNavigation isAdmin={admin} userProfile={userProfile} locale={locale} />
      <div className="flex min-h-full flex-col md:pl-60 print:pl-0">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 sm:px-7 sm:pt-8 md:pb-12 print:px-0 print:py-0">{children}</main>
        <footer className="border-t border-neutral-100 py-8 text-center text-sm text-neutral-500 print:hidden dark:border-neutral-800 dark:text-neutral-400">
          Transition LATAM — {locale === "en" ? "a platform by" : "una plataforma de"}{" "}
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
      <div className="fixed right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-end gap-2 print:hidden md:right-6 md:bottom-6 md:gap-3">
        <FollowNotifications events={followEvents} />
        <PremiumAiBar enabled={aiEnabled} initialMessages={aiMemory} locale={locale} />
      </div>
    </div>
  );
}
