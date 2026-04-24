/** Скелет-лоадер вместо full-screen spinner — страница не прыгает, layout стабильный. */
export function PlanSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-40 bg-slate-800 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[200px] rounded-2xl bg-slate-800/60 border border-slate-800" />
        ))}
      </div>
      <div className="h-[88px] rounded-2xl bg-slate-800/60 border border-slate-800" />
      <div className="h-[88px] rounded-2xl bg-slate-800/60 border border-slate-800" />
    </div>
  );
}
