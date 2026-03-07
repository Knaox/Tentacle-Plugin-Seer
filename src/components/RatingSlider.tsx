import { useTranslation } from "react-i18next";

interface RatingSliderProps {
  value: number | null;
  onChange: (v: number | null) => void;
}

export function RatingSlider({ value, onChange }: RatingSliderProps) {
  const { t } = useTranslation("seer");
  const current = value ?? 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          {t("filterRating")}
        </h4>
        <span className="text-xs font-medium text-white/60">
          {current > 0 ? `${current.toFixed(1)}+` : t("filterRatingAny")}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={current}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(v > 0 ? v : null);
        }}
        className="w-full accent-[#8b5cf6]"
      />
      <div className="mt-1 flex justify-between text-[10px] text-white/20">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}
