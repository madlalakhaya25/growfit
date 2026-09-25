import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDayMonth } from "@/lib/time";

/** Merge conditional class names and de-duplicate conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a human-readable relative time string ("2h ago", "Yesterday", "12 Jun").
 * Intended for server-rendered timestamps — pass the ISO string, get a readable label.
 */
export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const ts = new Date(dateStr).getTime();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDayMonth(dateStr);
}

/** Days from now (positive = future, negative = past). */
export function daysFromNow(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

