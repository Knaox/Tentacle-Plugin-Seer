const SHIMMER_STYLE = {
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s ease infinite",
};

export function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl">
      <div
        className="aspect-[2/3] w-full rounded-xl"
        style={SHIMMER_STYLE}
      />
      <div className="mt-2 space-y-1.5 px-0.5">
        <div className="h-3.5 w-3/4 rounded" style={SHIMMER_STYLE} />
        <div className="h-3 w-1/3 rounded" style={SHIMMER_STYLE} />
      </div>
    </div>
  );
}
