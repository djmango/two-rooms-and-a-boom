import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const EM_DASH = "\u2014";

const TARGETS = ["index.html", "src", "shared", "worker"];
const EXCLUDE_DIRS = new Set(["node_modules", "dist", ".wrangler"]);
const EXCLUDE_FILES = new Set(["worker-configuration.d.ts"]);

function collectFiles(path: string, out: string[]): void {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    const name = path.split("/").pop()!;
    if (EXCLUDE_DIRS.has(name)) return;
    for (const entry of readdirSync(path)) {
      collectFiles(join(path, entry), out);
    }
    return;
  }
  if (EXCLUDE_FILES.has(path.split("/").pop()!)) return;
  out.push(path);
}

const files: string[] = [];
for (const target of TARGETS) {
  const abs = join(ROOT, target);
  try {
    collectFiles(abs, files);
  } catch {
    /* target may not exist; skip */
  }
}

let violations = 0;

for (const file of files) {
  const contents = readFileSync(file, "utf8");
  if (!contents.includes(EM_DASH)) continue;

  const lines = contents.split("\n");
  lines.forEach((line, i) => {
    if (line.includes(EM_DASH)) {
      violations += 1;
      console.error(`${relative(ROOT, file)}:${i + 1}: em dash not allowed in front end code`);
      console.error(`  ${line.trim()}`);
    }
  });
}

if (violations > 0) {
  console.error(`\nFAIL: ${violations} em dash violation${violations === 1 ? "" : "s"} found.`);
  console.error("Use a hyphen, colon, semicolon, or comma instead.");
  process.exit(1);
}

console.log("OK no em dashes found in front end source.");
