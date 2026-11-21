import { existsSync } from "node:fs";
import path from "node:path";
import type { DemoClip } from "@/components/demo-videos";

// Order and wording of the clips on the page. Files are the MP4s from
// web/scripts/demo-videos (npm run demo:videos), copied into site/public/demo/.
// A clip whose file isn't there yet is skipped, and the whole section hides
// when none are, so the site never shows a broken player.
const CLIPS: Omit<DemoClip, "src">[] = [
  { id: "01-squad-at-a-glance", title: "Your squad, one screen", blurb: "Every player, age group and status without a spreadsheet.", device: "desktop" },
  { id: "02-attendance-and-training", title: "Training & attendance", blurb: "Plan the week and get a flag when a player drops below 75%.", device: "desktop" },
  { id: "03-match-day", title: "Match day, sorted", blurb: "Fixtures, squads, results and the tactics board together.", device: "desktop" },
  { id: "04-talk-to-parents", title: "Keep parents informed", blurb: "Announce to a squad. Parents see only what is about their child.", device: "desktop" },
  { id: "05-parent-view", title: "What parents see", blurb: "The child's week on a phone, no WhatsApp scrolling.", device: "phone" },
  { id: "06-player-development", title: "Player development", blurb: "Players see their own growth, season by season.", device: "phone" },
  { id: "07-academy-health", title: "Run the academy", blurb: "Attendance, registration and results for funders and SAFA.", device: "desktop" },
];

export function availableClips(): DemoClip[] {
  return CLIPS.flatMap((c) =>
    existsSync(path.join(process.cwd(), "public", "demo", `${c.id}.mp4`))
      ? [{ ...c, src: `/demo/${c.id}.mp4` }]
      : [],
  );
}
