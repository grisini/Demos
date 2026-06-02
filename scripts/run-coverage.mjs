import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coverageDir = path.join(rootDir, "coverage");
const v8CoverageDir = path.join(coverageDir, "v8");
const lcovPath = path.join(coverageDir, "lcov.info");
const testFiles = [
  "tests/domain.test.mjs",
  "tests/e2e.test.mjs",
  "tests/performance.test.mjs"
];
const sourcePrefixes = ["src", "api", "server"];

rmSync(coverageDir, { recursive: true, force: true });
mkdirSync(v8CoverageDir, { recursive: true });

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, [testFile], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_V8_COVERAGE: v8CoverageDir
    },
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const coverage = collectV8Coverage(v8CoverageDir);
writeFileSync(lcovPath, buildLcov(coverage), "utf8");
console.info(`[coverage] LCOV report written to ${path.relative(rootDir, lcovPath)}`);

function collectV8Coverage(directory) {
  const scripts = new Map();
  for (const filePath of listJsonFiles(directory)) {
    const payload = JSON.parse(readFileSync(filePath, "utf8"));
    for (const script of payload.result || []) {
      const sourcePath = localSourcePath(script.url);
      if (!sourcePath) continue;

      const rangeCounts = scripts.get(sourcePath) || new Map();
      for (const fn of script.functions || []) {
        for (const range of fn.ranges || []) {
          const key = `${range.startOffset}:${range.endOffset}`;
          const previous = rangeCounts.get(key) || {
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            count: 0
          };
          previous.count += Number(range.count) || 0;
          rangeCounts.set(key, previous);
        }
      }
      scripts.set(sourcePath, rangeCounts);
    }
  }
  return scripts;
}

function listJsonFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsonFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
  });
}

function localSourcePath(url) {
  if (!url || !url.startsWith("file:")) return "";
  const filePath = path.resolve(fileURLToPath(url));
  const relativePath = path.relative(rootDir, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return "";
  if (![".js", ".mjs"].includes(path.extname(relativePath))) return "";
  const [prefix] = relativePath.split(path.sep);
  return sourcePrefixes.includes(prefix) ? filePath : "";
}

function buildLcov(coverage) {
  const records = sourceFiles()
    .map((filePath) => lcovRecord(filePath, [...(coverage.get(filePath)?.values() || [])]))
    .filter(Boolean);
  if (!records.length) {
    throw new Error("Coverage report did not include any source files.");
  }
  return `${records.join("\n")}\n`;
}

function sourceFiles(directory = rootDir) {
  return sourcePrefixes.flatMap((prefix) => listSourceFiles(path.join(directory, prefix)));
}

function listSourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return entry.isFile() && [".js", ".mjs"].includes(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function lcovRecord(filePath, ranges) {
  const source = readFileSync(filePath, "utf8");
  const starts = lineStarts(source);
  const lines = source.split(/\r?\n/);
  const dataLines = [];
  let hitLines = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (!isCoverableLine(lines[index])) continue;
    const hit = lineHitCount(ranges, starts[index], starts[index + 1] ?? source.length);
    if (hit > 0) hitLines += 1;
    dataLines.push(`DA:${index + 1},${hit > 0 ? 1 : 0}`);
  }

  if (!dataLines.length) return "";
  const relativePath = path.relative(rootDir, filePath).replaceAll(path.sep, "/");
  return [
    "TN:",
    `SF:${relativePath}`,
    ...dataLines,
    `LF:${dataLines.length}`,
    `LH:${hitLines}`,
    "end_of_record"
  ].join("\n");
}

function lineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function isCoverableLine(line) {
  const trimmed = line.trim();
  return Boolean(trimmed) && !trimmed.startsWith("//");
}

function lineHitCount(ranges, lineStart, lineEnd) {
  const candidates = ranges.filter((range) => range.startOffset < lineEnd && range.endOffset > lineStart);
  if (!candidates.length) return 0;
  candidates.sort((a, b) => rangeSize(a) - rangeSize(b));
  return candidates[0].count;
}

function rangeSize(range) {
  return range.endOffset - range.startOffset;
}
