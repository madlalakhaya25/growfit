// Records short marketing clips of the real app, one per scene in demo-videos/scenes.mjs.
//
//   DEMO_BASE_URL=http://localhost:3000 npm run demo:videos            # every scene
//   npm run demo:videos -- 03-match-day 05-parent-view                # chosen scenes
//   npm run demo:videos -- --smoke                                    # pipeline check, no login
//
// Output: web/demo-videos/out/<scene>.mp4 (git-ignored; upload the finished files to the site,
// YouTube or Drive). Needs ffmpeg on PATH.
//
// DATA SAFETY: this only logs in as the *.seed.growfit.test accounts from supabase/seed.sql,
// which are fictional. Point DEMO_BASE_URL at an app wired to a throwaway seeded project, never
// at production: footage of real children's names or photos is a POPIA problem once published.
import { mkdirSync, rmSync, existsSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";
import { ROLES, SCENES } from "./demo-videos/scenes.mjs";
import { VIDEOS, HIGHLIGHTS } from "./demo-videos/videos.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const outDir = path.join(webRoot, "demo-videos", "out");
const workDir = path.join(webRoot, "demo-videos", ".work");
const baseURL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const password = process.env.DEMO_PASSWORD ?? "SeedPass123!";

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 720 }, final: "1920:1080", isMobile: false },
  phone: { viewport: { width: 430, height: 932 }, final: "1080:2336", isMobile: true },
};

const args = process.argv.slice(2);
const smoke = args.includes("--smoke");
const clipsMode = args.includes("--clips"); // one MP4 per scene, no stitching
const wanted = args.filter((a) => !a.startsWith("--"));
const sceneById = new Map(SCENES.map((x) => [x.id, x]));
const matches = (id) => wanted.some((w) => id.startsWith(w));
// Default: the themed videos. Name a video or a scene to build just that; --clips for every scene.
const videos = smoke || clipsMode ? [] : VIDEOS.filter((v) => (wanted.length ? matches(v.id) : true));
const highlights = smoke || clipsMode ? [] : HIGHLIGHTS.filter((h) => (wanted.length ? matches(h.id) : true));
const scenes = smoke
  ? SCENES.filter((x) => x.id.includes("smoke"))
  : clipsMode || (wanted.length && videos.length === 0)
    ? SCENES.filter((x) => (wanted.length ? matches(x.id) : !x.skipByDefault && (!x.needsAi || process.env.DEMO_AI === "1")))
    : [];
if (scenes.length === 0 && videos.length === 0 && highlights.length === 0) {
  console.error("No matching videos or scenes.");
  process.exit(1);
}

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const OVERLAY = `(() => {
  if (window.__demoOverlay) return;
  window.__demoOverlay = true;
  const css = document.createElement("style");
  css.textContent = \`
    #demo-cap{position:fixed;left:50%;bottom:6%;transform:translateX(-50%) translateY(12px);max-width:86%;
      padding:14px 22px;border-radius:14px;background:rgba(10,20,15,.88);color:#fff;
      font:600 clamp(16px,2.1vw,26px)/1.3 system-ui,sans-serif;text-align:center;opacity:0;
      transition:opacity .35s,transform .35s;z-index:2147483646;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.35)}
    #demo-cap.on{opacity:1;transform:translateX(-50%) translateY(0)}
    #demo-cap.top{bottom:auto;top:3%}
    #demo-cur{position:fixed;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.9);
      border:3px solid #16a34a;z-index:2147483647;pointer-events:none;left:-40px;top:-40px;
      transform:translate(-50%,-50%);transition:transform .12s}
    #demo-cur.down{transform:translate(-50%,-50%) scale(.7)}
    nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button]{display:none!important}
    *{scroll-behavior:smooth}\`;
  document.documentElement.appendChild(css);
  const cap = document.createElement("div"); cap.id = "demo-cap";
  const cur = document.createElement("div"); cur.id = "demo-cur";
  const mount = () => { document.body.append(cap, cur); };
  document.body ? mount() : addEventListener("DOMContentLoaded", mount);
  addEventListener("mousemove", (e) => { cur.style.left = e.clientX + "px"; cur.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => cur.classList.add("down"), true);
  addEventListener("mouseup", () => cur.classList.remove("down"), true);
  window.__setCaption = (t, pos) => { const c = document.getElementById("demo-cap"); if (!c) return;
    c.classList.toggle("top", pos === "top");
    if (!t) { c.classList.remove("on"); return; } c.textContent = t; c.classList.add("on"); };
})();`;

async function newContext(browser, device, storageState, record, viewport) {
  const d = { ...DEVICES[device], viewport: viewport ?? DEVICES[device].viewport };
  const ctx = await browser.newContext({
    baseURL,
    storageState,
    viewport: d.viewport,
    isMobile: d.isMobile,
    hasTouch: d.isMobile,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "no-preference",
    ...(record ? { recordVideo: { dir: workDir, size: d.viewport } } : {}),
  });
  await ctx.addInitScript(() => { try { localStorage.setItem("theme", "light"); } catch {} });
  return ctx;
}

async function login(browser, role) {
  const email = ROLES[role];
  const file = path.join(workDir, `${role}.json`);
  if (existsSync(file)) return file;
  const ctx = await newContext(browser, "desktop", undefined, false);
  const page = await ctx.newPage();
  await page.goto("/auth/login", { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    page.locator("form button[type=submit]").click(),
  ]);
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

async function glide(page, x, y) {
  await page.mouse.move(x, y, { steps: 25 });
}

let recordStart = 0;
let leadIn = 0; // seconds of recording before the first real screen, trimmed off in encode()

async function clickTarget(page, spec, optional = false) {
  const target = spec.startsWith("role:")
    ? page.getByRole(...(() => { const [, role, name] = spec.split(":"); return [role, { name: new RegExp(name, "i") }]; })()).first()
    : spec.match(/^[.#\[]/) ? page.locator(spec).first() : page.getByText(spec, { exact: false }).first();
  const box = await target.boundingBox({ timeout: optional ? 2500 : 8000 }).catch(() => null);
  if (!box) { if (!optional) console.warn(`  could not find "${spec}"`); return; }
  await glide(page, box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(350);
  // optional: a button that is legitimately disabled (e.g. Save when nothing changed on a re-run).
  if (optional) await target.click({ timeout: 2000 }).catch(() => {});
  else await target.click();
}

async function pitchPoint(page, on, [fx, fy]) {
  const r = await page.locator(on).first().boundingBox();
  return [r.x + r.width * fx, r.y + r.height * fy];
}

// One thing a viewer sees happen. Pitch coordinates are fractions (0-1) of the element `on`.
async function doAction(page, a, scene, pos) {
  if (a.caption !== undefined) await page.evaluate(([t, p]) => window.__setCaption?.(t, p), [a.caption, a.captionAt ?? pos]);
  if (a.click) { await clickTarget(page, a.click, a.optional); await page.waitForLoadState("networkidle").catch(() => {}); }
  if (a.expand) {
    // Open a collapsed <details> by its summary text; leave it alone if it is already open.
    const sum = page.locator("details:not([open]) > summary", { hasText: a.expand }).first();
    if (await sum.count()) {
      const b = await sum.boundingBox();
      if (b) await glide(page, b.x + 20, b.y + b.height / 2);
      await page.waitForTimeout(300);
      await sum.click();
      await page.waitForTimeout(400);
    }
  }
  if (a.check) {
    // Idempotent on purpose: a re-run must not untick what an earlier run ticked.
    const box = page.getByLabel(a.check, { exact: false }).first();
    const b = await box.boundingBox();
    if (b) await glide(page, b.x + 10, b.y + b.height / 2);
    await page.waitForTimeout(300);
    await box.check();
  }
  if (a.select) {
    const sel = page.locator(a.select.selector).first();
    const box = await sel.boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    await sel.selectOption(a.select.index !== undefined ? { index: a.select.index } : { label: a.select.label });
  }
  if (a.key) await page.keyboard.press(a.key);
  if (a.center) { await page.locator(a.center).first().evaluate((e) => e.scrollIntoView({ block: "center" })); await page.waitForTimeout(500); }
  if (a.top) { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500); }
  if (a.drag) {
    const { on, from, to } = a.drag;
    const [x1, y1] = await pitchPoint(page, on, from);
    const [x2, y2] = await pitchPoint(page, on, to);
    await glide(page, x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 22 });
    await page.mouse.up();
  }
  if (a.type) {
    const t = page.locator(a.type.selector).first();
    const box = await t.boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2);
    await t.click();
    await page.keyboard.type(a.type.text, { delay: 55 });
  }
  if (a.press) await page.keyboard.press(a.press);
  if (a.waitFor) {
    const w = a.waitFor;
    const loc = w.selector ? page.locator(w.selector).first() : page.getByText(w.text, { exact: false }).first();
    await loc.waitFor({ timeout: w.timeout ?? 45_000 }).catch(() => console.warn(`  never saw ${w.selector ?? w.text}`));
  }
  if (a.scroll) {
    const frames = 30;
    for (let i = 0; i < frames; i++) { await page.mouse.wheel(0, a.scroll / frames); await page.waitForTimeout(40); }
  }
  await page.waitForTimeout(a.after ?? 700);
}

async function runStep(page, step, scene) {
  const device = scene.device;
  const vp = scene.viewport ?? DEVICES[device].viewport;
  if (step.goto) await page.goto(step.goto, { waitUntil: "networkidle" });
  // Loading skeletons look unfinished on camera: wait for them to go.
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), null, { timeout: 10_000 }).catch(() => {});
  await page.evaluate(OVERLAY);
  await page.waitForTimeout(500);
  if (!leadIn) leadIn = Math.max(0, (Date.now() - recordStart) / 1000 - 0.4);
  const pos = scene.captionAt ?? "bottom";
  if (step.caption) await page.evaluate(([t, p]) => window.__setCaption?.(t, p), [step.caption, pos]);
  const hold = step.hold ?? (step.actions ? 2500 : 3500);
  if (step.click) { await clickTarget(page, step.click); await page.waitForLoadState("networkidle").catch(() => {}); }
  for (const a of step.actions ?? []) await doAction(page, a, scene, pos);
  if (step.scroll) {
    const frames = 40;
    for (let i = 0; i < frames; i++) {
      await page.mouse.wheel(0, step.scroll / frames);
      await page.waitForTimeout(Math.max(20, (hold - 800) / frames));
    }
    await page.waitForTimeout(800);
  } else if (step.actions) {
    await page.waitForTimeout(hold);
  } else {
    // A little cursor drift so the screen never looks frozen.
    await glide(page, vp.width * 0.6, vp.height * 0.4);
    await page.waitForTimeout(hold);
  }
  await page.evaluate(() => window.__setCaption?.(""));
  await page.waitForTimeout(350);
}

function endCardPng(browser, device, viewport) {
  return (async () => {
    const d = { ...DEVICES[device], viewport: viewport ?? DEVICES[device].viewport };
    const ctx = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const logo = readFileSync(path.resolve(webRoot, "..", "growfit.png")).toString("base64");
    await page.setContent(`<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:2.4vh;background:#0b1f14;color:#fff;font-family:system-ui,sans-serif;text-align:center">
      <img src="data:image/png;base64,${logo}" style="height:22vh;border-radius:18px">
      <div style="font-size:${device === "phone" ? 40 : 54}px;font-weight:800">Growfit FA</div>
      <div style="font-size:${device === "phone" ? 22 : 28}px;opacity:.85;padding:0 6vw">Run your academy like a pro.<br>U11 · U13 · U15 · Greater Durban</div></body>`);
    const file = path.join(workDir, `endcard-${device}.png`);
    await page.screenshot({ path: file });
    await ctx.close();
    return file;
  })();
}

function encode(webm, endcard, device, out, trim) {
  const { final } = DEVICES[device];
  const [w, h] = final.split(":");
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0b1f14,fps=30,format=yuv420p,setsar=1`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-ss", String(trim), "-i", webm,
    "-loop", "1", "-t", "2.5", "-i", endcard,
    "-f", "lavfi", "-t", "1", "-i", "anullsrc=r=44100:cl=stereo",
    "-filter_complex",
    `[0:v]${vf}[a];[1:v]${vf},fade=t=in:st=0:d=0.4[b];[a][b]concat=n=2:v=1:a=0[v]`,
    "-map", "[v]", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", out,
  ]);
}

// ── Stitching ────────────────────────────────────────────────────────────
const CANVAS = { w: 1920, h: 1080 };
const FADE = 0.45;
const BRAND = "0b1f14";
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
const NORM = `fps=30,format=yuv420p,setsar=1`;

/** One recorded scene, trimmed and put on a 1920x1080 canvas. Phones sit on a branded backdrop. */
function segmentMp4(scene, webm, trim, backdropPng) {
  const out = path.join(workDir, `seg-${scene.id}.mp4`);
  const phone = scene.device === "phone";
  const args = ["-y", "-loglevel", "error", "-ss", String(trim), "-i", webm];
  let filter;
  if (phone) {
    args.push("-loop", "1", "-i", backdropPng);
    filter = `[0:v]scale=-2:960:flags=lanczos,setsar=1[p];[1:v]scale=${CANVAS.w}:${CANVAS.h}[bg];[bg][p]overlay=W-w-210:(H-h)/2:shortest=1,${NORM}[v]`;
  } else {
    filter = `[0:v]scale=${CANVAS.w}:${CANVAS.h}:force_original_aspect_ratio=decrease,pad=${CANVAS.w}:${CANVAS.h}:(ow-iw)/2:(oh-ih)/2:color=0x${BRAND},${NORM}[v]`;
  }
  execFileSync("ffmpeg", [...args, "-filter_complex", filter, "-map", "[v]", "-c:v", "libx264", "-crf", "19", "-preset", "medium", out]);
  return out;
}

/** A still shown for a few seconds, as a clip, so it can be cross-faded like everything else. */
function cardMp4(png, seconds, name) {
  const out = path.join(workDir, `${name}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-t", String(seconds), "-i", png,
    "-vf", `scale=${CANVAS.w}:${CANVAS.h},${NORM}`, "-c:v", "libx264", "-crf", "19", out]);
  return out;
}

async function htmlPng(browser, html, name) {
  const ctx = await browser.newContext({ viewport: { width: CANVAS.w, height: CANVAS.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html);
  const file = path.join(workDir, `${name}.png`);
  await page.screenshot({ path: file });
  await ctx.close();
  return file;
}

const LOGO = () => readFileSync(path.resolve(webRoot, "..", "growfit.png")).toString("base64");
const FONT = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

function titleHtml(v) {
  return `<body style="margin:0;width:${CANVAS.w}px;height:${CANVAS.h}px;background:radial-gradient(ellipse at 30% 20%,#14402a,#${BRAND} 70%);color:#fff;font-family:${FONT};display:flex;align-items:center;padding:0 170px;box-sizing:border-box">
    <div><img src="data:image/png;base64,${LOGO()}" style="height:120px;border-radius:20px;margin-bottom:56px;display:block">
    <div style="font-size:26px;letter-spacing:.32em;color:#7ee2a8;font-weight:700;margin-bottom:26px">${v.kicker ?? "GROWFIT FA"}</div>
    <div style="font-size:92px;font-weight:800;line-height:1.05;max-width:1400px">${v.title}</div>
    <div style="font-size:38px;line-height:1.35;color:#cfe8d9;margin-top:34px;max-width:1300px">${v.subtitle ?? ""}</div></div></body>`;
}

function backdropHtml(scene) {
  const n = scene.sideNote ?? { kicker: "", text: "" };
  return `<body style="margin:0;width:${CANVAS.w}px;height:${CANVAS.h}px;background:radial-gradient(ellipse at 20% 30%,#14402a,#${BRAND} 72%);color:#fff;font-family:${FONT};display:flex;align-items:center;padding:0 150px;box-sizing:border-box">
    <div style="max-width:760px"><div style="font-size:24px;letter-spacing:.3em;color:#7ee2a8;font-weight:700;margin-bottom:22px">${n.kicker}</div>
    <div style="font-size:66px;font-weight:800;line-height:1.1">${n.text}</div></div></body>`;
}

/** Chain clips with a cross-fade. Every input is already 1920x1080 at 30fps. */
function stitch(files, out) {
  const d = files.map(probe);
  const inputs = files.flatMap((f) => ["-i", f]);
  let filter = "";
  let last = "[0:v]";
  let acc = d[0];
  for (let i = 1; i < files.length; i++) {
    const offset = (acc - FADE).toFixed(3);
    const label = i === files.length - 1 ? "[v]" : `[x${i}]`;
    filter += `${last}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset}${label};`;
    last = label;
    acc += d[i] - FADE;
  }
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filter.replace(/;$/, ""),
    "-map", "[v]", "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  return acc;
}

async function recordScene(browser, scene) {
  const storage = scene.role === "public" ? undefined : await login(browser, scene.role);
  const ctx = await newContext(browser, scene.device, storage, true, scene.viewport);
  const page = await ctx.newPage();
  recordStart = Date.now();
  leadIn = 0;
  for (const step of scene.steps) await runStep(page, step, scene);
  const video = page.video();
  await ctx.close(); // flushes the recording
  return { webm: await video.path(), trim: leadIn };
}

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
let failed = 0;
try {
  // One MP4 per scene (the old behaviour, and the smoke test).
  for (const scene of scenes) {
    console.log(`▶ ${scene.id}  (${scene.role}, ${scene.device})`);
    try {
      const { webm, trim } = await recordScene(browser, scene);
      const card = await endCardPng(browser, scene.device, scene.viewport);
      const out = path.join(outDir, `${scene.id}.mp4`);
      encode(webm, card, scene.device, out, trim);
      console.log(`  ✔ ${path.relative(webRoot, out)}`);
    } catch (err) {
      failed++;
      console.error(`  ✖ ${scene.id}: ${err.message}`);
    }
  }

  // Themed videos: title card, recorded segments cross-faded, end card.
  for (const v of videos) {
    console.log(`▶▶ ${v.id}: ${v.title}`);
    try {
      const files = [cardMp4(await htmlPng(browser, titleHtml(v), `title-${v.id}`), 2.6, `title-${v.id}`)];
      for (const id of v.parts) {
        const scene = sceneById.get(id);
        if (!scene) throw new Error(`unknown scene "${id}"`);
        console.log(`   • ${id}`);
        const { webm, trim } = await recordScene(browser, scene);
        const backdrop = scene.device === "phone" ? await htmlPng(browser, backdropHtml(scene), `bd-${id}`) : null;
        files.push(segmentMp4(scene, webm, trim, backdrop));
      }
      const end = await endCardPng(browser, "desktop", { width: 1280, height: 720 });
      files.push(cardMp4(end, 2.6, `end-${v.id}`));
      const out = path.join(outDir, `${v.id}.mp4`);
      const secs = stitch(files, out);
      console.log(`  ✔ ${path.relative(webRoot, out)}  (${secs.toFixed(0)}s)`);
    } catch (err) {
      failed++;
      console.error(`  ✖ ${v.id}: ${err.message}`);
    }
  }

  // Highlights: cuts from videos that are already built.
  for (const h of highlights) {
    console.log(`▶▶ ${h.id}: ${h.title}`);
    try {
      const files = [cardMp4(await htmlPng(browser, titleHtml(h), `title-${h.id}`), 2.6, `title-${h.id}`)];
      h.cuts.forEach((c, i) => {
        const src = path.join(outDir, `${c.src}.mp4`);
        if (!existsSync(src)) throw new Error(`build ${c.src} first`);
        const out = path.join(workDir, `cut-${h.id}-${i}.mp4`);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(c.from), "-t", String(c.to - c.from), "-i", src,
          "-vf", `scale=${CANVAS.w}:${CANVAS.h},${NORM}`, "-c:v", "libx264", "-crf", "19", out]);
        files.push(out);
      });
      files.push(cardMp4(await endCardPng(browser, "desktop", { width: 1280, height: 720 }), 2.6, `end-${h.id}`));
      const out = path.join(outDir, `${h.id}.mp4`);
      const secs = stitch(files, out);
      console.log(`  ✔ ${path.relative(webRoot, out)}  (${secs.toFixed(0)}s)`);
    } catch (err) {
      failed++;
      console.error(`  ✖ ${h.id}: ${err.message}`);
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
