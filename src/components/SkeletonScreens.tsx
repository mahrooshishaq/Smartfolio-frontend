import type { ReactNode } from 'react';

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-gradient-to-r from-sky-100 via-indigo-100 to-teal-100 ${className}`} />;
}

function SkeletonCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[2rem] border border-gray-50 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="space-y-8">
      <SkeletonCard className="rounded-[2.5rem] p-5 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-8 w-56 max-w-full" />
            <SkeletonBlock className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-3">
            <SkeletonBlock className="h-10 w-36" />
            <SkeletonBlock className="h-10 w-28" />
            <SkeletonBlock className="h-10 w-32" />
          </div>
        </div>
        <div className="mt-6 border-t border-gray-50 pt-5">
          <SkeletonBlock className="h-3 w-40" />
          <SkeletonBlock className="mt-3 h-2 w-full rounded-full" />
        </div>
      </SkeletonCard>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index}>
            <div className="mb-4 flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
            <SkeletonBlock className="h-8 w-16" />
            <SkeletonBlock className="mt-2 h-3 w-24" />
          </SkeletonCard>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonCard>
          <SkeletonBlock className="mb-5 h-4 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-8 w-full" />
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonBlock className="mb-5 h-4 w-36" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <SkeletonBlock className="h-9 w-9" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-4/5" />
                  <SkeletonBlock className="h-3 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}

export function JobsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading jobs" className="space-y-8">
      <SearchSkeleton headingWidth="w-48" actionWidth="w-36" />
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-10 w-56" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} className="p-7">
            <div className="flex items-start gap-4">
              <SkeletonBlock className="h-12 w-12" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-5 w-4/5" />
                <SkeletonBlock className="h-4 w-32" />
              </div>
              <SkeletonBlock className="h-9 w-20" />
            </div>
            <SkeletonBlock className="mt-4 h-4 w-full" />
            <SkeletonBlock className="mt-2 h-4 w-3/4" />
            <div className="mt-4 flex flex-wrap gap-2">
              <SkeletonBlock className="h-7 w-20" />
              <SkeletonBlock className="h-7 w-24" />
              <SkeletonBlock className="h-7 w-28" />
            </div>
            <div className="mt-5 border-t border-gray-50 pt-4">
              <SkeletonBlock className="h-4 w-36" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export function CoursesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading courses" className="space-y-8">
      <SearchSkeleton headingWidth="w-56" actionWidth="w-40" />
      <SkeletonBlock className="h-4 w-32" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[2rem] border border-gray-50 bg-white shadow-sm">
            <SkeletonBlock className="h-40 w-full rounded-none" />
            <div className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-4 w-20" />
              </div>
              <SkeletonBlock className="h-5 w-full" />
              <SkeletonBlock className="h-5 w-4/5" />
              <SkeletonBlock className="h-4 w-36" />
              <div className="flex gap-2">
                <SkeletonBlock className="h-7 w-20" />
                <SkeletonBlock className="h-7 w-28" />
              </div>
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-3/4" />
              <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-9 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrackerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading job tracker" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <SkeletonBlock className="h-8 w-44" />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
        </div>
        <SkeletonBlock className="h-12 w-44" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-9 w-24" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} className="p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-5 w-4/5" />
                <SkeletonBlock className="h-4 w-36" />
              </div>
              <SkeletonBlock className="h-8 w-28" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SkeletonBlock className="h-7 w-24" />
              <SkeletonBlock className="h-7 w-32" />
              <SkeletonBlock className="h-7 w-20" />
            </div>
            <SkeletonBlock className="mt-5 h-16 w-full" />
            <div className="mt-5 flex items-center justify-between border-t border-gray-50 pt-4">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-8 w-20" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export function MockInterviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading mock interview" className="mx-auto max-w-5xl space-y-8">
      <div className="rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-teal-50 p-7 shadow-sm md:p-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-9 w-72 max-w-full" />
            <SkeletonBlock className="h-4 w-96 max-w-full" />
          </div>
          <div className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 shadow-lg shadow-blue-200/60">
            <div className="h-16 w-16 animate-pulse rounded-full bg-white/80" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={index}>
            <SkeletonBlock className="h-10 w-10" />
            <SkeletonBlock className="mt-5 h-5 w-3/4" />
            <SkeletonBlock className="mt-3 h-4 w-full" />
            <SkeletonBlock className="mt-2 h-4 w-4/5" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="p-7">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="mt-5 h-32 w-full" />
        <div className="mt-5 flex flex-wrap gap-3">
          <SkeletonBlock className="h-11 w-36" />
          <SkeletonBlock className="h-11 w-32" />
        </div>
      </SkeletonCard>
    </div>
  );
}

function SearchSkeleton({ headingWidth, actionWidth }: { headingWidth: string; actionWidth: string }) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <SkeletonBlock className={`h-8 ${headingWidth}`} />
          <SkeletonBlock className="h-4 w-72 max-w-full" />
        </div>
        <SkeletonBlock className={`h-12 ${actionWidth}`} />
      </div>
      <SkeletonCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SkeletonBlock className="h-12 flex-1" />
          <SkeletonBlock className="h-12 w-28" />
          <SkeletonBlock className="h-8 w-16" />
        </div>
      </SkeletonCard>
    </>
  );
}
