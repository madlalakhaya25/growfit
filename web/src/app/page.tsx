import {
  LineChart,
  ShieldCheck,
  Shield,
  Star,
  Target,
  Trophy,
  Users,
  Dumbbell,
  Megaphone,
  Wand2,
  FileCheck,
  BookOpen,
  Camera,
  Building2,
  Brain,
  LayoutGrid,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RatingRing } from "@/components/ui/rating-ring";
import { StatBar } from "@/components/ui/stat-bar";

const ROLES = [
  {
    Icon: Target,
    title: "Player",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    description: "Your career, all in one place.",
    bullets: [
      "Digital passport with a shareable QR code",
      "Match ratings and performance history",
      "Training attendance and session notes",
      "Development milestones across 5 categories",
      "Watch your coach's plays and hear their voice note",
    ],
  },
  {
    Icon: Users,
    title: "Coach",
    color: "bg-primary/10 text-primary",
    description: "Tools that make coaching easier.",
    bullets: [
      "AI assistant that knows your squad by name",
      "Tactical board with formations, animation, and video export",
      "AI session plans aligned to FIFA LTPD and SAFA NDP",
      "Suggested XI, match plans, and post-match reports",
    ],
  },
  {
    Icon: Shield,
    title: "Parent",
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
    description: "Always know what's happening.",
    bullets: [
      "Live updates on fixtures and training",
      "AI progress reports framed around the LTPD stage",
      "Sign documents digitally: POPIA, consent, medical",
      "Your child's ratings and milestone progress",
    ],
  },
  {
    Icon: Building2,
    title: "Admin",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    description: "Run your academy, your way.",
    bullets: [
      "Academy-wide analytics and compliance dashboards",
      "SAFA document compliance tracking (6 docs per player)",
      "Squad, team, and player management",
      "AI academy health report benchmarked to SAFA NDP",
    ],
  },
];

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: "Digital Player Passport",
    text: "A verified, shareable profile with a unique QR code. Scouts and coaches can see ratings, attributes, and milestones at a glance.",
  },
  {
    Icon: Wand2,
    title: "AI Session Generator",
    text: "Builds LTPD-phased drills with 4-Corner coaching cues, a FIFA session structure, and SAFA NDP competency alignment.",
  },
  {
    Icon: Brain,
    title: "AI Coach Assistant",
    text: "Ask about your own squad and get answers grounded in real ratings, form, attendance, and results. It suggests an XI and writes the match plan.",
  },
  {
    Icon: LayoutGrid,
    title: "Tactical Board",
    text: "Set your squad in any formation from 5-a-side to 11-a-side, draw runs and passes, animate the play, and share it to the squad as a video.",
  },
  {
    Icon: Brain,
    title: "AI Match and Player Reports",
    text: "Post-match reports, individual insights, and parent letters, each grounded in FIFA technical methodology and SAFA standards.",
  },
  {
    Icon: LineChart,
    title: "Academy Analytics",
    text: "SAFA-benchmarked dashboards showing position spread, rating trends, document compliance, training attendance, and top performers.",
  },
  {
    Icon: Star,
    title: "Performance Ratings",
    text: "Coaches rate players out of 5 after every match or session. Notes, history, and trend charts build a long-term record.",
  },
  {
    Icon: Dumbbell,
    title: "Training Management",
    text: "Plan sessions with drill lists, session types, attendance tracking, and media uploads tagged to individual players.",
  },
  {
    Icon: FileCheck,
    title: "SAFA Document Compliance",
    text: "Track all 6 registration documents per player, per season: registration agreement, POPIA consent, medical consent, and more.",
  },
  {
    Icon: BookOpen,
    title: "Development Milestones",
    text: "Five development categories (Technical, Tactical, Physical, Mental, Leadership) with milestone tracking each season.",
  },
  {
    Icon: Trophy,
    title: "Match Centre",
    text: "Fixtures, results, squad appearances, match attendance, and win/draw/loss records in one place for every team.",
  },
  {
    Icon: Megaphone,
    title: "Announcements",
    text: "Coaches post updates straight to the squad. Players and parents stay informed, and coaches can see who has read each message.",
  },
  {
    Icon: Camera,
    title: "Media Gallery",
    text: "Upload photos and videos from training or matches, tag players, and build a visual record of every session.",
  },
  {
    Icon: Target,
    title: "Multi-Role Platform",
    text: "Admin, Coach, Player, and Parent each get their own dedicated dashboard. One account, one academy, everyone connected.",
  },
];

const ATTRIBUTES = [
  { label: "Pace", value: 82 },
  { label: "Shooting", value: 75 },
  { label: "Passing", value: 76 },
  { label: "Dribbling", value: 80 },
  { label: "Defending", value: 64 },
];

const FRAMEWORKS = [
  "FIFA LTPD",
  "SAFA NDP",
  "CAF Pathway",
  "4-Corner Model",
  "SAFA Registration",
  "UEFA Best Practice",
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            <a className="text-sm text-muted-foreground hover:text-foreground transition-colors" href="#roles">Roles</a>
            <a className="text-sm text-muted-foreground hover:text-foreground transition-colors" href="#features">Features</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link href="/auth/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="brand" className="mb-4">
              #WeBuildChampions
            </Badge>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Football development, built for{" "}
              <span className="text-primary">South African academies.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg leading-relaxed">
              Players get a digital passport. Coaches get AI session plans.
              Academies get analytics that lines up with what SAFA and FIFA
              actually expect.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/auth/register">
                  Create your passport
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                ["4", "User roles"],
                ["13", "AI tools"],
                ["360°", "Player view"],
              ].map(([n, label]) => (
                <div key={label}>
                  <dt className="text-3xl font-extrabold tabular-nums text-primary">{n}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Passport preview */}
          <Card className="mx-auto w-full max-w-sm overflow-hidden shadow-xl">
            <div className="h-1.5 bg-brand" />
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-lg">Daniel Mbatha</CardTitle>
                <CardDescription>Right Winger · U17 Squad</CardDescription>
              </div>
              <RatingRing value={78} size={84} />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="brand">Winger</Badge>
                <Badge variant="neutral">Age 16</Badge>
                <Badge variant="neutral">Right foot</Badge>
              </div>
              <div className="space-y-2.5 pt-1">
                {ATTRIBUTES.map((a) => (
                  <StatBar key={a.label} label={a.label} value={a.value} />
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-green-500" aria-hidden="true" />
                  SAFA Registered
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-green-500" aria-hidden="true" />
                  Docs Complete
                </span>
                <span className="font-medium text-foreground">Training to Compete</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Framework alignment strip ─────────────────────── */}
        <div className="border-y border-border bg-muted/40">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Aligned with</span>
            {FRAMEWORKS.map((f) => (
              <span key={f} className="text-sm font-medium text-foreground/70">{f}</span>
            ))}
          </div>
        </div>

        {/* ── Roles ──────────────────────────────────────────── */}
        <section id="roles" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight">One platform, every role</h2>
            <p className="mt-2 text-muted-foreground max-w-xl">
              Every person in the academy sees what matters to them, without the clutter.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(({ Icon, title, color, description, bullets }) => (
              <Link key={title} href="/auth/register">
                <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                  <CardHeader className="pb-3">
                    <span className={`mb-2 grid size-11 place-items-center rounded-lg ${color}`}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary/60" aria-hidden="true" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* ── AI callout ─────────────────────────────────────── */}
        <section className="border-y border-border bg-primary/5">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <Badge variant="brand" className="mb-4">AI-Powered Development</Badge>
                <h2 className="text-3xl font-bold tracking-tight">
                  Thirteen AI tools, each shaped by{" "}
                  <span className="text-primary">FIFA, SAFA and CAF standards.</span>
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  Every one is built around the FIFA Long-Term Player Development
                  framework, the 4-Corner Model, and SAFA&apos;s National Development
                  Programme. So coaches and parents get feedback that&apos;s grounded
                  in how youth development actually works, not just numbers on a screen.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {[
                  { icon: Brain,      label: "AI Coach Assistant",      desc: "Squad-aware answers, suggested XI, and match plans" },
                  { icon: LayoutGrid, label: "Tactical Analysis",       desc: "Reads the board, explains a play, counters the opponent" },
                  { icon: Wand2,      label: "AI Session Planner",     desc: "LTPD-phased drills with 4-Corner coaching cues" },
                  { icon: Brain,      label: "Player Insights",         desc: "Position competencies and pathway readiness" },
                  { icon: Trophy,     label: "Match Reports",           desc: "FIFA technical methodology with a development lens" },
                  { icon: Shield,     label: "Parent Progress Reports", desc: "Warm, readable letters grounded in the player's LTPD stage" },
                  { icon: LineChart,  label: "Academy Health Report",   desc: "SAFA NDP benchmarks for academy directors" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────── */}
        <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight">Everything the academy needs</h2>
            <p className="mt-2 text-muted-foreground max-w-xl">
              From the first registration document to match day, Growfit FA handles
              the admin so coaches can focus on the football.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, text }) => (
              <div key={title} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
                <span className="grid size-10 place-items-center rounded-lg bg-brand/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────── */}
        <section className="border-t border-border bg-muted/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
            <Badge variant="brand">#WeBuildChampions</Badge>
            <h2 className="text-3xl font-bold tracking-tight max-w-xl">
              Get your academy up and running today.
            </h2>
            <p className="text-muted-foreground max-w-md">
              Free to try and takes less than 10 minutes to set up.
              Your players, coaches, and parents will all have what they need from day one.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/auth/register">
                  Get started free
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/login">Sign in to your academy</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <Logo />
              <p className="text-sm text-muted-foreground max-w-xs">
                Good football development shouldn&apos;t be complicated. We&apos;re here to make it simple.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex flex-wrap gap-2">
                {["FIFA LTPD", "SAFA NDP", "CAF Pathway", "4-Corner Model"].map((f) => (
                  <span key={f} className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {f}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Growfit FA
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
