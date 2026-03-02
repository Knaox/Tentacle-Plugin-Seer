import { useTranslation } from "react-i18next";
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "../hooks/useNotifications";
import { posterUrl } from "../utils/media-helpers";

const TYPE_COLORS: Record<string, string> = {
  request_sent: "text-blue-400",
  request_approved: "text-purple-400",
  request_downloading: "text-orange-400",
  request_available: "text-emerald-400",
  request_declined: "text-red-400",
  request_failed: "text-red-400",
};

export function NotificationsPanel() {
  const { t } = useTranslation("seer");
  const { data, isLoading } = useNotifications(false, 1, 50);
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();

  const notifications = data?.results ?? [];

  return (
    <div className="px-4 pt-4 md:px-12">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t("seer:notificationsTitle")}</h1>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:bg-white/10"
          >
            {t("seer:markAllRead")}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-white/5 p-3 animate-pulse">
              <div className="h-12 w-8 rounded bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const poster = posterUrl(notif.posterPath, "w92");
            const color = TYPE_COLORS[notif.type] || "text-white/60";
            const relDate = new Date(notif.createdAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={notif.id}
                className={`flex gap-3 rounded-xl p-3 transition-colors ${
                  notif.read ? "bg-white/3" : "bg-white/5 hover:bg-white/8"
                }`}
                onClick={() => { if (!notif.read) markRead.mutate(notif.id); }}
              >
                {poster ? (
                  <img src={poster} alt="" className="h-12 w-8 flex-shrink-0 rounded object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-12 w-8 flex-shrink-0 items-center justify-center rounded bg-white/5">
                    <div className={`h-2 w-2 rounded-full ${color.replace("text-", "bg-")}`} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${notif.read ? "text-white/40" : "text-white"}`}>
                    {notif.title}
                  </p>
                  <p className={`text-xs ${notif.read ? "text-white/20" : "text-white/50"}`}>
                    {notif.message}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/20">{relDate}</p>
                </div>
                {!notif.read && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <svg className="mb-4 h-12 w-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-sm text-white/30">{t("seer:noNotifications")}</p>
        </div>
      )}
    </div>
  );
}
