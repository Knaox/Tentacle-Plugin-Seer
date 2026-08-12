import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../../api/types-releases";
import { ReleaseRow } from "./ReleaseRow";
import { monthMatrix, weekdayInitials, today, monthHeading } from "../../utils/calendar-groups";
import { KIND_STYLE } from "../../utils/calendar-kind";
import { parseAirDate } from "../../utils/episode-dates";

interface Props {
  items: CalendarItem[];
  onOpen?: (item: CalendarItem) => void;
}

/** Vue d'ensemble : une pastille par sortie, le détail au clic sur un jour. */
export function ReleaseMonthView({ items, onOpen }: Props) {
  const { t } = useTranslation("seer");
  const ref = today();

  const [cursor, setCursor] = useState(() => {
    const first = items[0]?.date ?? ref;
    const d = parseAirDate(first) ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const bucket = map.get(it.date);
      if (bucket) bucket.push(it);
      else map.set(it.date, [it]);
    }
    return map;
  }, [items]);

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const initials = useMemo(() => weekdayInitials(), []);
  const monthLabel = monthHeading(
    `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-01`,
  );

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const dayItems = selected ? byDate.get(selected) ?? [] : [];

  return (
    <div className="pb-10">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          aria-label={t("seer:releasesMonthPrev")}
          className="rounded-lg bg-tentacle-fill-subtle px-3 py-1.5 text-sm text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium"
        >
          ‹
        </button>
        <span className="text-sm font-semibold capitalize text-tentacle-text-primary">{monthLabel}</span>
        <button
          onClick={() => shift(1)}
          aria-label={t("seer:releasesMonthNext")}
          className="rounded-lg bg-tentacle-fill-subtle px-3 py-1.5 text-sm text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-medium"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-tentacle-text-quaternary">
        {initials.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((date) => {
          const dayList = byDate.get(date) ?? [];
          const inMonth = Number(date.slice(5, 7)) === cursor.month + 1;
          const isToday = date === ref;
          const isSelected = date === selected;

          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(dayList.length > 0 ? (isSelected ? null : date) : null)}
              disabled={dayList.length === 0}
              className={`flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg p-1 text-[11px] transition-colors ${
                isSelected ? "bg-tentacle-fill-medium" : dayList.length > 0 ? "bg-tentacle-fill-subtle hover:bg-tentacle-fill-medium" : ""
              } ${inMonth ? "text-tentacle-text-secondary" : "text-tentacle-text-disabled"} ${
                isToday ? "ring-1 ring-tentacle-brand" : ""
              }`}
            >
              <span className={isToday ? "font-bold text-tentacle-brand" : ""}>{Number(date.slice(8, 10))}</span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {dayList.slice(0, 4).map((it) => (
                  <span key={it.id} className={`h-1.5 w-1.5 rounded-full ${KIND_STYLE[it.kind].dot}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {selected && dayItems.length > 0 && (
        <div className="mt-4 space-y-2" style={{ animation: "fadeSlideUp 250ms ease forwards" }}>
          {dayItems.map((item) => <ReleaseRow key={item.id} item={item} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}
