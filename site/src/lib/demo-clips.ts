import { existsSync } from "node:fs";
import path from "node:path";
import type { DemoClip } from "@/components/demo-videos";

// Order and wording of the clips on the page. Files are the MP4s from
// web/scripts/demo-videos (npm run demo:videos), copied into site/public/demo/.
// A clip whose file isn't there yet is skipped, and the whole section hides
// when none are, so the site never shows a broken player.
const CLIPS: Omit<DemoClip, "src">[] = [
  { id: "00-growfit-in-60-seconds", title: "Growfit in under a minute", blurb: "The whole app in a quick tour.", device: "desktop" },
  { id: "01-plan-and-train", title: "Plan & train", blurb: "Week plans, AI-built sessions with diagrams, a register in seconds and welfare flags.", device: "desktop" },
  { id: "02-match-day", title: "Match day", blurb: "Team sheet, fair playing time and the tactics board, including 3D.", device: "desktop" },
  { id: "03-ai-coaching", title: "AI coaching insights", blurb: "Ask about your own squad, get a starting XI, a scouting report, a match plan and player insights.", device: "desktop" },
  { id: "04-your-philosophy", title: "Your philosophy, built in", blurb: "Write what the academy teaches by age group and see what has really been trained.", device: "desktop" },
  { id: "05-parents-and-players", title: "Parents & players", blurb: "Write once, simplify for the age group, and everyone gets what is about them.", device: "desktop" },
  { id: "06-run-the-academy", title: "Run the academy", blurb: "Compliance, live analytics, an AI health report and exports for funders and SAFA.", device: "desktop" },
];

export function availableClips(): DemoClip[] {
  return CLIPS.flatMap((c) =>
    existsSync(path.join(process.cwd(), "public", "demo", `${c.id}.mp4`))
      ? [{ ...c, src: `/demo/${c.id}.mp4` }]
      : [],
  );
}
