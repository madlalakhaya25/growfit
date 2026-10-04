// Hand a finished file to the phone's share sheet (WhatsApp is one of the
// choices) or, where there is none, to a download.

/** Can this browser share `file` through the system share sheet? True on
 * phones; usually false on desktops. */
export function canShareFile(file: File): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Open the share sheet. "cancelled" when the coach backs out, which is not a failure. */
export async function shareFile(file: File, title: string): Promise<"shared" | "cancelled" | "failed"> {
  try {
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (err) {
    return err instanceof DOMException && err.name === "AbortError" ? "cancelled" : "failed";
  }
}
