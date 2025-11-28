//src/app/components/KpiCard

"use client";

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 shadow-md">
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/40">{hint}</div> : null}
    </div>
  );
}
