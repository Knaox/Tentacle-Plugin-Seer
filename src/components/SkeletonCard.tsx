/**
 * Cartes fantômes du chargement.
 *
 * Le miroitement animait `background-position`, ce qui force une PEINTURE par
 * image — et il tournait sur une vingtaine de cartes à la fois, exactement
 * pendant que la page suivante chargeait, donc au pire moment. Il est désormais
 * porté par un calque qui se translate : seule `transform` est animée, comme
 * l'exige la règle GPU du projet.
 */

const SURFACE = "relative overflow-hidden bg-tentacle-fill-subtle";

function Shimmer({ className }: { className: string }) {
  return (
    <div className={`${SURFACE} ${className}`}>
      <div
        aria-hidden
        className="absolute inset-y-0 w-1/3"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)",
          animation: "seerIndeterminate 1.6s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl">
      <Shimmer className="aspect-[2/3] w-full rounded-xl" />
      <div className="mt-2 space-y-1.5 px-0.5">
        <Shimmer className="h-3.5 w-3/4 rounded" />
        <Shimmer className="h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}
