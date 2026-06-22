export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="6" fill="#af2d35" />
        <path
          d="M16 6 C10 6 7 10 7 14 C7 20 16 26 16 26 C16 26 25 20 25 14 C25 10 22 6 16 6 Z"
          fill="white"
          fillOpacity="0.15"
        />
        <text
          x="16"
          y="21"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontWeight="800"
          fontSize="13"
          fill="white"
          letterSpacing="-0.5"
        >
          GF
        </text>
      </svg>
      <span className="text-lg font-bold tracking-tight">
        Growfit<span className="text-primary"> FA</span>
      </span>
    </span>
  );
}
