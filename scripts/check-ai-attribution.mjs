#!/usr/bin/env node
// Fails if any commit in the given range carries an AI co-author trailer or
// a generated-by signature. Dependency-free by design — it only needs `git`,
// which every runner already has.
//
// Usage: node scripts/check-ai-attribution.mjs <base-sha>..<head-sha>
//
// The range should be the pull request's own commits (base...head), not the
// whole branch history, so this never fails on commits already on main.

import { execFileSync } from "node:child_process";

const range = process.argv[2];
if (!range) {
  console.error("Usage: node scripts/check-ai-attribution.mjs <base-sha>..<head-sha>");
  process.exit(1);
}

// Matches a co-author trailer naming a known AI tool, or a common
// AI-generated signature line. Case-insensitive; \b keeps "claude" from
// matching inside an unrelated word.
const AI_SIGNATURE = /co-authored-by:.*\b(claude|copilot|chatgpt|openai|codex|gemini|qwen)\b/i;
const GENERATED_SIGNATURE = /generated (with|by)\s+(claude|copilot|chatgpt|codex|gemini)/i;
const EMOJI_SIGNATURE = /🤖\s*generated/i;
const SESSION_TRAILER = /^claude-session:/im;

function commitsInRange(range) {
  const out = execFileSync(
    "git",
    ["log", "--no-merges", "--format=%H%x00%B%x03", range],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 32 }
  );
  return out
    .split("\x03")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const nul = entry.indexOf("\x00");
      return { sha: entry.slice(0, nul), message: entry.slice(nul + 1).trim() };
    });
}

const commits = commitsInRange(range);
const offenders = commits.filter(
  ({ message }) =>
    AI_SIGNATURE.test(message) ||
    GENERATED_SIGNATURE.test(message) ||
    EMOJI_SIGNATURE.test(message) ||
    SESSION_TRAILER.test(message)
);

if (offenders.length > 0) {
  console.error(`Found AI attribution in ${offenders.length} commit(s):\n`);
  for (const { sha, message } of offenders) {
    console.error(`  ${sha.slice(0, 8)}  ${message.split("\n")[0]}`);
  }
  console.error(
    "\nCommits merged into main must not carry an AI co-author trailer or " +
      "generated-by signature. Rewrite the commit message(s) and force-push."
  );
  process.exit(1);
}

console.log(`Checked ${commits.length} commit(s) in ${range} — no AI attribution found.`);
