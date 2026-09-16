// Turns a local video or image file into a single still frame, as a data
// URL, for the film-breakdown surface (see components/tactics/film-board).
//
// Deliberately entirely client-side: the source video is never uploaded
// anywhere, only whatever still frame the coach freezes and draws on. That's
// the whole reason "local phone clip" is the primary source — the roadmap's
// standing non-goal is hosting/transcoding video, and this needs none of
// that infrastructure.
//
// Not unit-tested: everything here is canvas/DOM pixel work (drawImage,
// toDataURL), which jsdom doesn't actually rasterize — a test could only
// assert the mocks were called, not that the output is a real image. Same
// reasoning src/lib/pdf-headshots.ts and player-card-pdf.ts already apply to
// their own canvas/PDF drawing.

/** Longest side a captured frame is resized to before it's embedded in a
 * play's JSONB `data` — full camera/screen resolution would make an
 * ordinary breakdown several MB. 1280px is plenty to draw and read
 * annotations on a phone or laptop screen. */
const MAX_DIMENSION = 1280;

function resizedCanvas(sourceW: number, sourceH: number): { canvas: HTMLCanvasElement; w: number; h: number } {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceW, sourceH));
  const w = Math.max(1, Math.round(sourceW * scale));
  const h = Math.max(1, Math.round(sourceH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, w, h };
}

/** Draw the current frame of a playing/paused <video> to a resized still. */
export function captureVideoFrame(video: HTMLVideoElement): { dataUrl: string; w: number; h: number } | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const { canvas, w, h } = resizedCanvas(video.videoWidth, video.videoHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), w, h };
}

/** Load an image file and resize it to a still, the same way a frozen video
 * frame is — so a screenshot or match photo behaves identically to a phone
 * clip once it's on the board. */
export function loadImageFile(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { canvas, w, h } = resizedCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error("Could not read that image.")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image.")); };
    img.src = url;
  });
}
