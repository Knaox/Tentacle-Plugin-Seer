import { useTranslation } from "react-i18next";

interface Provider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

interface WatchProvidersProps {
  providers: Provider[];
}

export function WatchProviders({ providers }: WatchProvidersProps) {
  const { t } = useTranslation("seer");

  if (providers.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">
        {t("availableOn")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <div
            key={p.provider_id}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
          >
            <img
              src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
              alt={p.provider_name}
              className="h-5 w-5 rounded"
              loading="lazy"
            />
            <span className="text-xs text-white/60">{p.provider_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
