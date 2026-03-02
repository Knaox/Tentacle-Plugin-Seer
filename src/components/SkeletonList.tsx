import { SkeletonCard } from "./SkeletonCard";

interface SkeletonListProps {
  count?: number;
}

export function SkeletonList({ count = 12 }: SkeletonListProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
