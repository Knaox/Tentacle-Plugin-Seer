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
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
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
          className="w-24 rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-subtle px-3 py-1.5 text-xs text-tentacle-text-primary placeholder-tentacle-text-quaternary outline-none focus:border-[rgba(var(--brand-rgb),0.4)]"
        />
        <span className="text-xs text-tentacle-text-quaternary">&mdash;</span>
        <input
          type="number"
          min={1900}
          max={2030}
          placeholder={t("filterYearTo")}
          value={yearTo ?? ""}
          onChange={(e) => onYearToChange(parseYear(e.target.value))}
          className="w-24 rounded-lg border border-tentacle-border-subtle bg-tentacle-fill-subtle px-3 py-1.5 text-xs text-tentacle-text-primary placeholder-tentacle-text-quaternary outline-none focus:border-[rgba(var(--brand-rgb),0.4)]"
        />
      </div>
    </div>
  );
}
