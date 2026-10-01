import { Skeleton } from "@/components/ui/skeleton";

export function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading section">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-8 w-3/4" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-96 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full max-w-xl rounded-full" />
      <SectionSkeleton />
    </div>
  );
}
