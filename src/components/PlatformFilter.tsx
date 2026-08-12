import { useTranslation } from "react-i18next";
import { pill } from "../styles/pills";
import { PLATFORMS } from "../utils/platforms";

interface PlatformFilterProps {
  selected: number[];
  onToggle: (id: number) => void;
}

/**
 * Les plateformes de streaming. Même motif de pilule que les autres filtres :
 * la grille à deux colonnes avec coche mettait onze plateformes sur six lignes
 * pour des noms courts, et introduisait un troisième style de contrôle dans un
 * panneau qui en comptait déjà trop.
 */
export function PlatformFilter({ selected, onToggle }: PlatformFilterProps) {
  const { t } = useTranslation("seer");
  void t;

  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((p) => {
        const active = selected.includes(p.id);
        return (
          <button
            key={p.id}
            onClick={() => onToggle(p.id)}
            aria-pressed={active}
            className={pill(active)}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
