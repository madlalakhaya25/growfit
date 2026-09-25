// Tool icons drawn to match what each tool actually puts on the pitch — a
// dashed arrow for a pass, a wavy one for a dribble, a bar-ended line for a
// press — rather than generic glyphs a coach has to learn. Same props and
// 24×24 grid as lucide-react so they drop into the toolbar alongside it.

type IconProps = { className?: string; "aria-hidden"?: boolean | "true" | "false" };

function Svg({ children, className, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
      {children}
    </svg>
  );
}
const Head = ({ d }: { d: string }) => <path d={d} fill="currentColor" stroke="none" />;

export const RunIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20 L17 7" /><Head d="M20 4 L12.5 6.5 L17.5 11.5 Z" /></Svg>
);
export const PassIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20 L16.5 7.5" strokeDasharray="3 3" /><Head d="M20 4 L12.5 6.5 L17.5 11.5 Z" /></Svg>
);
export const DribbleIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 19 L6 14 L9 17 L12 12 L15 14 L16.5 10" /><Head d="M20 4 L13 7.5 L19 11 Z" /></Svg>
);
export const ShotIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20 L15 9" strokeWidth={3.4} />
    <Head d="M20.5 3.5 L11 6.5 L17.5 13 Z" />
    <path d="M17 17 L19 19 M19.5 14.5 L22 15 M14.5 19.5 L15 22" strokeWidth={1.6} />
  </Svg>
);
export const PressIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20 L17 7 M7 14.5 L9.5 17 M10.5 11 L13 13.5 M14.5 4.5 L19.5 9.5" /></Svg>
);
export const CurveIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20 C4 11 9 6 16.5 5.5" /><Head d="M21 5.5 L14.5 2 L14.5 9 Z" /></Svg>
);
export const StraightIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20 L17 7" /><Head d="M20 4 L12.5 6.5 L17.5 11.5 Z" /></Svg>
);
export const CurveRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20 C13 20 18 15 18.5 7.5" /><Head d="M18.5 3 L15 9.5 L22 9.5 Z" /></Svg>
);
export const ZoneRectIcon = (p: IconProps) => (
  <Svg {...p}><rect x={3.5} y={5.5} width={17} height={13} rx={1.5} fill="currentColor" fillOpacity={0.2} strokeDasharray="3 2" /></Svg>
);
export const ZoneEllipseIcon = (p: IconProps) => (
  <Svg {...p}><ellipse cx={12} cy={12} rx={9} ry={6.5} fill="currentColor" fillOpacity={0.2} strokeDasharray="3 2" /></Svg>
);
export const LassoIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 9 C4 4 13 2.5 18 5.5 C22 8 20 14 14 15 C9 16 5 14 5 9 Z" fill="currentColor" fillOpacity={0.2} strokeDasharray="3 2" /></Svg>
);
export const HatchIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x={3.5} y={3.5} width={17} height={17} rx={1.5} />
    <path d="M3.5 12 L12 3.5 M3.5 20 L20 3.5 M12 20.5 L20.5 12" strokeWidth={1.6} />
  </Svg>
);
export const SolidFillIcon = (p: IconProps) => (
  <Svg {...p}><rect x={3.5} y={3.5} width={17} height={17} rx={1.5} fill="currentColor" fillOpacity={0.35} /></Svg>
);
/** Line-weight icons — one fixed component per weight, so the toolbar
 * never builds a new component type during render. */
export const ThinLineIcon = (p: IconProps) => <Svg {...p}><path d="M4 12 L20 12" strokeWidth={1.6} /></Svg>;
export const NormalLineIcon = (p: IconProps) => <Svg {...p}><path d="M4 12 L20 12" strokeWidth={2.4} /></Svg>;
export const BoldLineIcon = (p: IconProps) => <Svg {...p}><path d="M4 12 L20 12" strokeWidth={3.6} /></Svg>;
