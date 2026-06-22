import {
  LineChart, Shield, Target, Trophy, Users,
  Dumbbell, Megaphone, Wand2, FileCheck, BookOpen, Camera,
  Building2, Brain, CheckCircle2, ArrowRight, ShieldCheck, Star,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.growfitfa.co.za";

const ROLES = [
  {
    num: "01", Icon: Target, title: "Player",
    description: "Your career, all in one place.",
    bullets: [
      "Digital passport with a shareable QR code",
      "Match ratings and performance history",
      "Training attendance and session notes",
      "Development milestones across 5 categories",
    ],
  },
  {
    num: "02", Icon: Users, title: "Coach",
    description: "Tools that make coaching easier.",
    bullets: [
      "AI session plans aligned to FIFA LTPD and SAFA NDP",
      "Post-match ratings, reports, and analysis",
      "Player attribute assessments (4-Corner Model)",
      "Fixtures, training, and team announcements",
    ],
  },
  {
    num: "03", Icon: Shield, title: "Parent",
    description: "Always know what's happening.",
    bullets: [
      "Live updates on fixtures and training",
      "AI progress reports framed around the LTPD stage",
      "Sign documents digitally: POPIA, consent, medical",
      "Your child's ratings and milestone progress",
    ],
  },
  {
    num: "04", Icon: Building2, title: "Admin",
    description: "Run your academy, your way.",
    bullets: [
      "Academy-wide analytics and compliance dashboards",
      "SAFA document compliance tracking (6 docs per player)",
      "Squad, team, and player management",
      "AI academy health report benchmarked to SAFA NDP",
    ],
  },
];

const AI_REPORTS = [
  { num: "01", Icon: Wand2,     label: "AI Session Planner",     desc: "LTPD-phased drills with 4-Corner coaching cues" },
  { num: "02", Icon: Brain,     label: "Player Insights",         desc: "Position competencies and pathway readiness" },
  { num: "03", Icon: Trophy,    label: "Match Reports",           desc: "FIFA technical methodology with a development lens" },
  { num: "04", Icon: Shield,    label: "Parent Progress Reports", desc: "Warm, readable letters grounded in the player's LTPD stage" },
  { num: "05", Icon: LineChart, label: "Academy Health Report",   desc: "SAFA NDP benchmarks for academy directors" },
];

const FEATURES = [
  { num: "01", Icon: ShieldCheck, title: "Digital Player Passport",   text: "A verified, shareable profile with a unique QR code. Scouts and coaches see ratings, attributes, and milestones at a glance." },
  { num: "02", Icon: Wand2,       title: "AI Session Generator",      text: "Builds LTPD-phased drills with 4-Corner coaching cues, a FIFA session structure, and SAFA NDP competency alignment." },
  { num: "03", Icon: Brain,       title: "AI Match & Player Reports", text: "Post-match reports, individual insights, and parent letters grounded in FIFA technical methodology and SAFA standards." },
  { num: "04", Icon: LineChart,   title: "Academy Analytics",         text: "SAFA-benchmarked dashboards: position spread, rating trends, document compliance, attendance, and top performers." },
  { num: "05", Icon: Star,        title: "Performance Ratings",       text: "Coaches rate players out of 5 after every match or session. Notes, history, and trend charts build a long-term record." },
  { num: "06", Icon: Dumbbell,    title: "Training Management",       text: "Plan sessions with drill lists, session types, attendance tracking, and media uploads tagged to individual players." },
  { num: "07", Icon: FileCheck,   title: "SAFA Document Compliance",  text: "Track all 6 registration documents per player, per season: registration agreement, POPIA consent, medical consent, and more." },
  { num: "08", Icon: BookOpen,    title: "Development Milestones",    text: "Five development categories (Technical, Tactical, Physical, Mental, Leadership) with milestone tracking each season." },
  { num: "09", Icon: Trophy,      title: "Match Centre",              text: "Fixtures, results, squad appearances, match attendance, and win/draw/loss records in one place for every team." },
  { num: "10", Icon: Megaphone,   title: "Announcements",             text: "Coaches post updates straight to the squad. Players and parents stay informed. Coaches see who's read each message." },
  { num: "11", Icon: Camera,      title: "Media Gallery",             text: "Upload photos and videos from training or matches, tag players, and build a visual record of every session." },
  { num: "12", Icon: Target,      title: "Multi-Role Platform",       text: "Admin, Coach, Player, and Parent each get their own dedicated dashboard. One account, one academy, everyone connected." },
];

const ATTRS = [
  { label: "PAC", value: 82 },
  { label: "SHO", value: 75 },
  { label: "PAS", value: 76 },
  { label: "DRI", value: 80 },
  { label: "DEF", value: 64 },
  { label: "PHY", value: 71 },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b-2 border-[#af2d35]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors tracking-wide" href="#roles">ROLES</a>
            <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors tracking-wide" href="#features">FEATURES</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href={`${APP_URL}/auth/login`}
              className="hidden sm:inline-flex items-center px-4 h-9 text-sm font-semibold border border-border rounded hover:bg-muted transition-colors">
              Sign in
            </a>
            <a href={`${APP_URL}/auth/register`}
              className="inline-flex items-center gap-1.5 px-4 h-9 text-sm font-bold bg-[#af2d35] text-white rounded hover:bg-[#c23340] transition-colors">
              Get started
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="bg-[#0c0c0d] text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 lg:py-24">
            <div className="grid gap-14 lg:grid-cols-[1fr_auto] lg:items-center">

              <div className="max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#af2d35] mb-5">
                  #WeBuildChampions
                </p>
                <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] font-extrabold leading-[0.92] tracking-tighter">
                  BUILD THE<br />
                  NEXT<br />
                  <span className="text-[#af2d35]">GENERATION.</span>
                </h1>
                <p className="mt-7 text-white/60 text-base sm:text-lg leading-relaxed max-w-lg">
                  Football development, built for South African academies.
                  Digital passports, AI coaching tools, and analytics that
                  lines up with what SAFA and FIFA actually expect.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href={`${APP_URL}/auth/register`}
                    className="inline-flex items-center gap-2 bg-[#af2d35] text-white px-6 py-3.5 font-bold text-base rounded hover:bg-[#c23340] transition-colors">
                    Create your passport
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                  <a href={`${APP_URL}/auth/login`}
                    className="inline-flex items-center gap-2 border border-white/20 text-white px-6 py-3.5 font-semibold text-base rounded hover:bg-white/5 transition-colors">
                    Sign in
                  </a>
                </div>

                {/* Stats row */}
                <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-3 gap-6 max-w-xs">
                  {[["4", "User roles"], ["5", "AI reports"], ["360°", "Player view"]].map(([n, label]) => (
                    <div key={label}>
                      <p className="text-3xl font-extrabold tabular-nums text-[#af2d35]">{n}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Player card — trading card style */}
              <div className="bg-[#141416] border border-white/10 rounded overflow-hidden w-64 shrink-0 mx-auto lg:mx-0">
                <div className="h-1 bg-[#af2d35]" />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/30">U17 &middot; Right Winger</p>
                      <h3 className="text-lg font-extrabold text-white mt-1 leading-tight">Daniel Mbatha</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-extrabold tabular-nums text-[#af2d35] leading-none">78</p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mt-0.5">OVR</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/8 pt-4">
                    {ATTRS.map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2.5">
                        <span className="text-[10px] font-bold text-white/30 w-7 shrink-0 tabular-nums">{label}</span>
                        <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                          <div className="h-full bg-[#af2d35] rounded-full" style={{ width: `${value}%` }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums text-white/50 w-5 text-right">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8">
                    <span className="flex items-center gap-1 text-[9px] font-semibold text-green-400 uppercase tracking-wide">
                      <CheckCircle2 className="size-2.5" aria-hidden="true" />
                      SAFA Reg.
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-semibold text-green-400 uppercase tracking-wide">
                      <CheckCircle2 className="size-2.5" aria-hidden="true" />
                      Docs Done
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Framework strip ──────────────────────────────── */}
        <div className="bg-[#af2d35]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">Aligned with</span>
            {["FIFA LTPD", "SAFA NDP", "CAF Pathway", "4-Corner Model", "SAFA Registration"].map((f) => (
              <span key={f} className="text-xs font-bold uppercase tracking-widest text-white">{f}</span>
            ))}
          </div>
        </div>

        {/* ── Roles ────────────────────────────────────────── */}
        <section id="roles" className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-16">
          <div className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#af2d35] mb-2">Your role</p>
            <h2 className="text-4xl font-extrabold tracking-tight">One platform. Every role.</h2>
            <p className="mt-2 text-muted-foreground max-w-lg">
              Every person in the academy sees what matters to them, without the clutter.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 border border-border">
            {ROLES.map(({ num, Icon, title, description, bullets }) => (
              <a key={title} href={`${APP_URL}/auth/register`}
                className="p-6 border-b border-r border-border hover:bg-muted/40 transition-colors group">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-5xl font-extrabold text-primary/10 tabular-nums leading-none">{num}</span>
                  <span className="grid size-9 place-items-center rounded bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-snug">{description}</p>
                <ul className="space-y-1.5">
                  {bullets.map((b) => (
                    <li key={b} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="mt-1.5 size-1 rounded-full bg-[#af2d35] shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Get started <ArrowRight className="size-3" />
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* ── AI section ───────────────────────────────────── */}
        <section className="bg-[#0c0c0d] text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#af2d35] mb-4">AI Engine</p>
                <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
                  Five AI reports.<br />
                  <span className="text-white/30">Each one grounded in</span><br />
                  FIFA, SAFA &amp; CAF.
                </h2>
                <p className="mt-5 text-white/50 leading-relaxed max-w-md">
                  Each report is built around the FIFA Long-Term Player Development
                  framework, the 4-Corner Model, and SAFA&apos;s National Development
                  Programme. Coaches and parents get feedback grounded in how youth
                  development actually works.
                </p>
              </div>

              {/* Lineup sheet */}
              <div className="border border-white/10 divide-y divide-white/8">
                {AI_REPORTS.map(({ num, Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
                    <span className="text-[10px] font-bold text-white/20 tabular-nums mt-0.5 w-5 shrink-0">{num}</span>
                    <Icon className="size-4 text-[#af2d35] shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-white">{label}</p>
                      <p className="text-xs text-white/35 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────── */}
        <section id="features" className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-16">
          <div className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#af2d35] mb-2">Inside the platform</p>
            <h2 className="text-4xl font-extrabold tracking-tight">Everything the academy needs.</h2>
            <p className="mt-2 text-muted-foreground max-w-lg">
              From the first registration document to match day, Growfit FA handles the admin
              so coaches can focus on the football.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-border">
            {FEATURES.map(({ num, Icon, title, text }) => (
              <div key={title} className="border-b border-r border-border p-5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-primary/40 tabular-nums">{num}</span>
                  <Icon className="size-3.5 text-primary/50" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="bg-[#af2d35]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50 mb-4">#WeBuildChampions</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white max-w-xl mx-auto leading-tight tracking-tight">
              Get your academy up and running today.
            </h2>
            <p className="mt-4 text-white/70 max-w-md mx-auto">
              Free to try. Takes less than 10 minutes to set up.
              Your players, coaches, and parents will have what they need from day one.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href={`${APP_URL}/auth/register`}
                className="inline-flex items-center gap-2 bg-white text-[#af2d35] px-6 py-3.5 font-bold text-base rounded hover:bg-white/90 transition-colors">
                Get started free
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <a href={`${APP_URL}/auth/login`}
                className="inline-flex items-center border border-white/30 text-white px-6 py-3.5 font-semibold text-base rounded hover:bg-white/10 transition-colors">
                Sign in to your academy
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="bg-[#0c0c0d] text-white/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <Logo className="[&_span:last-child]:text-white [&_img]:opacity-80" />
              <p className="text-xs max-w-xs leading-relaxed">
                Good football development shouldn&apos;t be complicated. We&apos;re here to make it simple.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {["FIFA LTPD", "SAFA NDP", "CAF Pathway", "4-Corner Model"].map((f) => (
                  <span key={f} className="text-[10px] font-bold uppercase tracking-widest">{f}</span>
                ))}
              </div>
              <p className="text-xs">&copy; {new Date().getFullYear()} Growfit FA</p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
