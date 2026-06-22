export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/growfit.png" alt="" width={32} height={32} className="rounded-sm" />
      <span className="text-lg font-bold tracking-tight">
        Growfit<span className="text-primary"> FA</span>
      </span>
    </span>
  );
}
