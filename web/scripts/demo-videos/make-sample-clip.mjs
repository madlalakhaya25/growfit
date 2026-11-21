// Makes the sample "match clip" the Film scene loads: demo-videos/assets/demo-match-clip.mp4.
//
//   node scripts/demo-videos/make-sample-clip.mjs
//
// It is a clearly synthetic clip (two teams as moving discs on a pitch, with "Simulated clip: not real match
// footage" in the corner). There is no real footage and no children in it. To show real footage in the Film
// video, put your own consented clip at demo-videos/assets/demo-match-clip.mp4 instead. Needs ffmpeg on PATH.
import { mkdirSync, copyFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const assets = path.join(webRoot, "demo-videos", "assets");
const work = path.join(webRoot, "demo-videos", ".work-clip");
mkdirSync(assets, { recursive: true });
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: work, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.setContent(`<body style="margin:0;background:#2f7d3a"><canvas id=c width=1280 height=720></canvas><script>
const g=c.getContext('2d');const W=1280,H=720;const t0=performance.now();
const red=[[300,180],[300,360],[300,540],[520,250],[520,470],[700,360],[900,200],[900,520]];
const blue=[[980,180],[980,360],[980,540],[760,250],[760,470],[560,360],[380,220],[380,500]];
function draw(){const t=(performance.now()-t0)/1000;
 g.fillStyle='#2f7d3a';g.fillRect(0,0,W,H);
 for(let i=0;i<12;i++){g.fillStyle=i%2?'#2b7435':'#33843f';g.fillRect(i*W/12,0,W/12,H);}
 g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=4;g.strokeRect(40,40,W-80,H-80);
 g.beginPath();g.moveTo(W/2,40);g.lineTo(W/2,H-40);g.stroke();g.beginPath();g.arc(W/2,H/2,90,0,7);g.stroke();
 g.strokeRect(40,H/2-170,170,340);g.strokeRect(W-210,H/2-170,170,340);
 const mv=(p,i,col)=>{const x=p[0]+Math.sin(t*1.1+i)*34+t*14,y=p[1]+Math.cos(t*0.9+i*1.7)*26;
  g.fillStyle=col;g.beginPath();g.arc(x,y,17,0,7);g.fill();g.strokeStyle='#fff';g.lineWidth=3;g.stroke();return [x,y];};
 const rp=red.map((p,i)=>mv(p,i,'#d62828')),bp=blue.map((p,i)=>mv(p,i+3,'#1d4ed8'));
 const k=rp[5];g.fillStyle='#fff';g.beginPath();g.arc(k[0]+24,k[1]+4,9,0,7);g.fill();g.strokeStyle='#111';g.lineWidth=2;g.stroke();
 g.fillStyle='rgba(0,0,0,.55)';g.fillRect(20,H-58,420,38);g.fillStyle='#fff';g.font='20px sans-serif';g.fillText('Simulated clip: not real match footage',32,H-32);
 requestAnimationFrame(draw);}
draw();<\/script></body>`);
await page.waitForTimeout(9000);
const video = page.video();
await ctx.close();
const webm = path.join(work, "clip.webm");
copyFileSync(await video.path(), webm);
await browser.close();

const out = path.join(assets, "demo-match-clip.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart", "-an", out]);
rmSync(work, { recursive: true, force: true });
console.log(`wrote ${path.relative(webRoot, out)}`);
