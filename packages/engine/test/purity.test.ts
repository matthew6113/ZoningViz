import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Working rule: the engine package has no browser imports. The tsconfig omits
// the DOM lib, which catches globals like `window`; this test catches imports.
const SRC = join(import.meta.dirname, "..", "src");
const BROWSER_MODULES = [
  /^react(-dom)?(\/|$)/,
  /^three(\/|$)/,
  /^@react-three\//,
  /^maplibre-gl(\/|$)/,
  /^gsap(\/|$)/,
  /^pmtiles(\/|$)/,
];
// Matches `... from "x"`, bare `import "x"`, `import("x")` and `require("x")`.
const IMPORT_RE = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

describe("engine purity", () => {
  it("imports no browser-only modules", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(IMPORT_RE)) {
        const spec = match[1] ?? match[2] ?? match[3] ?? "";
        if (BROWSER_MODULES.some((re) => re.test(spec))) offenders.push(`${file}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
