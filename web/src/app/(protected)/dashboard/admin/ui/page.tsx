"use client";

import * as React from "react";
import { Calendar, Users, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTabs } from "@/components/ui/section-tabs";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Scoreline } from "@/components/ui/scoreline";
import { FixtureTicket } from "@/components/ui/fixture-ticket";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { InfoTip } from "@/components/ui/info-tip";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Internal-only style guide for the "Matchday" design system — not linked
 * from any nav, reached by URL only. Renders every new primitive from
 * docs/AI_FEATURES_AND_IA.md Part 4 in one place so a visual regression is
 * obvious in a screenshot diff without opening a dozen real pages. Not
 * gated behind a feature toggle since it holds no academy data.
 */
export default function UiGuidePage() {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader
        title="Matchday design system"
        description="Internal style guide — every shared primitive, light and dark."
        action={<Button size="sm" onClick={() => setSheetOpen(true)}>Open sheet</Button>}
      />

      <section className="space-y-3">
        <h2 className="font-display text-xl">Type</h2>
        <p className="font-display text-3xl">Display: Matchday, U13 vs Durban Rovers</p>
        <p className="text-base">Body copy: short, second-person, sounds like a coach.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Buttons &amp; badges</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm">Primary</Button>
          <Button variant="brand" size="sm">Brand</Button>
          <Button variant="secondary" size="sm">Secondary</Button>
          <Button variant="outline" size="sm">Outline</Button>
          <Button variant="ghost" size="sm">Ghost</Button>
          <Button variant="destructive" size="sm">Destructive</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Present</Badge>
          <Badge variant="warning">At risk</Badge>
          <Badge variant="danger">Injured</Badge>
          <Badge variant="neutral">U13</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">StatTile</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Players" value={18} icon={Users} />
          <StatTile label="Attendance" value="82%" icon={Calendar} />
          <StatTile label="Overall" value={74} icon={Shield} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">PlayerAvatar</h2>
        <div className="flex items-end gap-4">
          <PlayerAvatar name="Sipho Ndlovu" jerseyNumber={9} size="sm" />
          <PlayerAvatar name="Sipho Ndlovu" jerseyNumber={9} size="md" />
          <PlayerAvatar name="Sipho Ndlovu" jerseyNumber={9} size="lg" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Scoreline</h2>
        <Card>
          <CardContent className="pt-5">
            <Scoreline homeLabel="Growfit U13" awayLabel="Durban Rovers" homeScore={2} awayScore={1} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <Scoreline homeLabel="Growfit U13" awayLabel="Durban Rovers" />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">FixtureTicket</h2>
        <FixtureTicket
          weekday="Sun"
          day="12"
          month="Oct"
          time="09:00"
          opponent="Durban Rovers"
          isHome
          venue="Growfit Grounds"
          teamName="U13"
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">
          ListRow <InfoTip>Replaces most card grids for anything that&apos;s really a list.</InfoTip>
        </h2>
        <Card>
          <ListRowGroup className="px-4">
            <ListRow
              leading={<PlayerAvatar name="Sipho Ndlovu" jerseyNumber={9} size="sm" />}
              title="Sipho Ndlovu"
              subtitle="Striker · U13"
              trailing="82%"
              href="#"
            />
            <ListRow
              leading={<PlayerAvatar name="Amahle Zulu" jerseyNumber={4} size="sm" />}
              title="Amahle Zulu"
              subtitle="Defender · U13"
              trailing="94%"
              href="#"
            />
          </ListRowGroup>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">EmptyState</h2>
        <Card>
          <EmptyState
            icon={Calendar}
            message="No fixtures scheduled yet."
            action={<Button size="sm" variant="outline">Schedule fixture</Button>}
          />
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">SectionTabs</h2>
        <SectionTabs
          tabs={[
            { href: "/dashboard/admin/ui", label: "Overview" },
            { href: "/dashboard/admin/ui#results", label: "Results" },
            { href: "/dashboard/admin/ui#film", label: "Film" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Card (unchanged API)</h2>
        <Card>
          <CardHeader>
            <CardTitle>Existing Card component</CardTitle>
          </CardHeader>
          <CardContent>Still works — new tokens flow through automatically.</CardContent>
        </Card>
      </section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Ask Growfit">
        <p className="text-sm text-muted-foreground">
          Bottom sheet on mobile, side panel on desktop. Esc or the backdrop closes it.
        </p>
      </Sheet>
    </div>
  );
}
