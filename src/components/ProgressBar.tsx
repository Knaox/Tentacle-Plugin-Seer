import { useTranslation } from "react-i18next";
import type { RequestStatus } from "../api/types";

interface ProgressBarProps {
  status: RequestStatus;
}

const STEPS: { key: RequestStatus; labelKey: string }[] = [
  { key: "queued", labelKey: "statusQueued" },
  { key: "sent_to_seer", labelKey: "statusSentToSeer" },
  { key: "approved", labelKey: "statusApproved" },
  { key: "downloading", labelKey: "statusDownloading" },
  { key: "available", labelKey: "statusAvailable" },
];

const STATUS_INDEX: Record<string, number> = {
  queued: 0,
  processing: 0,
  retry_pending: 0,
  sent_to_seer: 1,
  approved: 2,
  downloading: 3,
  available: 4,
};

export function ProgressBar({ status }: ProgressBarProps) {
  const { t } = useTranslation("seer");

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-red-500/30">
          <div className="h-full w-full rounded-full bg-red-500" />
        </div>
        <span className="text-xs text-red-400">{t("statusFailed")}</span>
      </div>
    );
  }

  const currentIdx = STATUS_INDEX[status] ?? 0;

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center gap-1">
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCompleted
                    ? "w-full bg-purple-500"
                    : isCurrent
                      ? "w-full bg-purple-500"
                      : "w-0"
                }`}
                style={isCurrent ? { animation: "pulseGlow 2s ease-in-out infinite" } : undefined}
              />
            </div>
            <span
              className={`hidden text-[10px] sm:block ${
                isCompleted || isCurrent ? "text-white/60" : "text-white/20"
              }`}
            >
              {t(step.labelKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
