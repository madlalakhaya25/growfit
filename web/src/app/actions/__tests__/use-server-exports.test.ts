/**
 * A "use server" file may export only async functions (and types, which are
 * erased). Anything else, such as a string constant, builds fine and passes
 * unit tests, then fails at runtime in production with "A "use server" file can
 * only export async functions, found string" and takes down every page that
 * imports the action. This reads every such file and refuses a value export.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const VALUE_EXPORT = /^export\s+(?!type\b|interface\b|async\s+function\b)(const|let|var|class|enum|function|default|\{|\*)/m;

describe("server action files", () => {
  const serverFiles = sourceFiles(join(__dirname, "..", "..")).filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")));

  it("finds the action files, so the check below is not vacuous", () => {
    expect(serverFiles.length).toBeGreaterThan(10);
  });

  it.each(serverFiles.map((f) => [f.split("/src/")[1], f]))("%s exports only async functions and types", (_name, file) => {
    const text = readFileSync(file, "utf8");
    const bad = text.split("\n").filter((line) => VALUE_EXPORT.test(line));
    expect(bad).toEqual([]);
  });
});
