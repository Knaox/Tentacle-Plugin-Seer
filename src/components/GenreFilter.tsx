import { useTranslation } from "react-i18next";
import type { Genre } from "../constants/genres";

interface GenreFilterProps {
  genres: Genre[];
  selected: number[];
  onToggle: (id: number) => void;
}

export function GenreFilter({ genres, selected, onToggle }: GenreFilterProps) {
  const { t } = useTranslation("seer");

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
        {t("filterGenres")}
      </h4>
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => {
          const active = selected.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => onToggle(g.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-[rgba(var(--brand-rgb),0.2)] text-tentacle-brand ring-1 ring-[rgba(var(--brand-rgb),0.5)]"
                  : "bg-tentacle-fill-subtle text-tentacle-text-tertiary hover:bg-tentacle-fill-medium hover:text-tentacle-text-secondary"
              }`}
            >
              {t(g.key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
