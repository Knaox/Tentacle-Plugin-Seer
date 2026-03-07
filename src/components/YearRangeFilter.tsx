import { useTranslation } from "react-i18next";

interface YearRangeFilterProps {
  yearFrom: number | null;
  yearTo: number | null;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
}

export function YearRangeFilter({ yearFrom, yearTo, onYearFromChange, onYearToChange }: YearRangeFilterProps) {
  const { t } = useTranslation("seer");

  const parseYear = (val: string): number | null => {
    if (!val) return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  };

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        {t("filterYear")}
      </h4>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1900}
          max={2030}
          placeholder={t("filterYearFrom")}
          value={yearFrom ?? ""}
          onChange={(e) => onYearFromChange(parseYear(e.target.value))}
          className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-purple-500/40"
        />
        <span className="text-xs text-white/30">&mdash;</span>
        <input
          type="number"
          min={1900}
          max={2030}
          placeholder={t("filterYearTo")}
          value={yearTo ?? ""}
          onChange={(e) => onYearToChange(parseYear(e.target.value))}
          className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-purple-500/40"
        />
      </div>
    </div>
  );
}
