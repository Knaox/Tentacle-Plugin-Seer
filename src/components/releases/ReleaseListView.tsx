import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../../api/types-releases";
import { ReleaseRow } from "./ReleaseRow";
import { groupByDay, dayHeading, monthHeading, monthKey, today } from "../../utils/calendar-groups";

interface Props {
  items: CalendarItem[];
  onOpen?: (item: CalendarItem) => void;
}

/**
 * Liste chronologique groupée par jour, plutôt qu'une grille mensuelle.
 *
 * Un calendrier de sorties est épars : une grille afficherait surtout des
 * cases vides, avec des affiches trop petites pour être reconnues, et
 * deviendrait illisible sur mobile. La liste garde des visuels lisibles et le
 * même rendu sur toutes les tailles d'écran. La vue mois reste disponible pour
 * qui veut la vue d'ensemble.
 */
export function ReleaseListView({ items, onOpen }: Props) {
  const { t } = useTranslation("seer");
  const groups = useMemo(() => groupByDay(items), [items]);
  const ref = today();

  let lastMonth = "";

  return (
    <div className="space-y-5 pb-10">
      {groups.map((group) => {
        const month = monthKey(group.date);
        const showMonth = month !== lastMonth;
        lastMonth = month;
        const isToday = group.date === ref;

        return (
          <Fragment key={group.date}>
            {showMonth && (
              <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-tentacle-text-quaternary">
                {monthHeading(group.date)}
              </h2>
            )}

            <section>
              {/* En-tête collant : on garde le repère de date en défilant. */}
              <h3
                className={`sticky top-0 z-10 -mx-1 mb-2 bg-tentacle-surface-1/95 px-1 py-1.5 text-sm font-semibold backdrop-blur ${
                  isToday ? "text-tentacle-brand" : "text-tentacle-text-secondary"
                }`}
              >
                {dayHeading(group.date, t)}
                <span className="ml-2 text-xs font-normal text-tentacle-text-quaternary">
                  {t("seer:releasesCount", { count: group.items.length })}
                </span>
              </h3>

              <div className="space-y-2">
                {group.items.map((item) => (
                  <ReleaseRow key={item.id} item={item} onOpen={onOpen} />
                ))}
              </div>
            </section>
          </Fragment>
        );
      })}
    </div>
  );
}
