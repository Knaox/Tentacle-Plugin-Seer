import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useProviderCatalog, providerLogoUrl, providerInitials } from "../hooks/useProviderCatalog";

/**
 * « C'est déjà sur Netflix » — les plateformes d'abonnement où un titre se
 * regarde aujourd'hui.
 *
 * On montre les logos : reconnus d'un coup d'œil et compacts, là où trois noms
 * écrits occuperaient toute une ligne. Un logo seul n'étant pas accessible, le
 * nom reste porté par le `title` et par un libellé de groupe pour les lecteurs
 * d'écran. Quand un logo manque, on affiche les initiales plutôt qu'un trou.
 */

interface Props {
  providerIds: readonly number[];
  /** Vignettes affichées avant le « +N ». */
  max?: number;
  size?: "sm" | "md";
}

const SIZE = {
  sm: "h-4 w-4 text-[7px]",
  md: "h-[18px] w-[18px] text-[8px]",
} as const;

export const PlatformBadges = memo(function PlatformBadges({
  providerIds, max = 3, size = "md",
}: Props) {
  const { t } = useTranslation("seer");
  const catalog = useProviderCatalog();

  if (providerIds.length === 0) return null;

  const known = providerIds
    .map((id) => catalog.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (known.length === 0) return null;

  const shown = known.slice(0, max);
  const extra = known.length - shown.length;
  const names = known.map((p) => p.name).join(", ");
  const box = SIZE[size];

  return (
    <span
      className="inline-flex items-center gap-1"
      title={t("seer:streamingOn", { platforms: names })}
      aria-label={t("seer:streamingOn", { platforms: names })}
    >
      {shown.map((p) => {
        const logo = providerLogoUrl(p.logoPath);
        return logo ? (
          <img
            key={p.id}
            src={logo}
            alt=""
            aria-hidden
            loading="lazy"
            className={`${box} shrink-0 rounded-[4px] object-cover ring-1 ring-tentacle-border-subtle`}
          />
        ) : (
          <span
            key={p.id}
            aria-hidden
            className={`${box} flex shrink-0 items-center justify-center rounded-[4px] bg-tentacle-fill-medium font-bold text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle`}
          >
            {providerInitials(p.name)}
          </span>
        );
      })}
      {extra > 0 && (
        <span aria-hidden className="text-[10px] font-medium text-tentacle-text-quaternary">
          +{extra}
        </span>
      )}
    </span>
  );
});
