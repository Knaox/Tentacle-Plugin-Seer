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
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
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
                  ? "bg-[#8b5cf6]/20 text-[#8b5cf6] ring-1 ring-[#8b5cf6]/50"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
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
