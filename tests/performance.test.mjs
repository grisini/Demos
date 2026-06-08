import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const budgets = {
  initialRawBytes: 230 * 1024,
  initialGzipBytes: 60 * 1024,
  mainRawBytes: 166 * 1024,
  mainGzipBytes: 42 * 1024,
  cssRawBytes: 70 * 1024,
  cssGzipBytes: 14 * 1024
};

test("performance: zacetni frontend payload ostane znotraj budgeta", () => {
  const initialFiles = ["index.html", "src/main.js", "src/styles.css"];
  const rawBytes = initialFiles.reduce((sum, file) => sum + statSync(file).size, 0);
  const gzipBytes = initialFiles.reduce((sum, file) => sum + gzipSize(file), 0);

  assert.ok(rawBytes <= budgets.initialRawBytes, `Initial raw payload ${rawBytes} presega ${budgets.initialRawBytes}`);
  assert.ok(gzipBytes <= budgets.initialGzipBytes, `Initial gzip payload ${gzipBytes} presega ${budgets.initialGzipBytes}`);
});

test("performance: glavni JS in CSS imata locena budgeta", () => {
  assertFileBudget("src/main.js", budgets.mainRawBytes, budgets.mainGzipBytes);
  assertFileBudget("src/styles.css", budgets.cssRawBytes, budgets.cssGzipBytes);
});

test("performance: DOCX/ODT generator ni del zacetnega modula", () => {
  const main = readFileSync("src/main.js", "utf8");
  assert.doesNotMatch(main, /from\s+["']\.\/lib\/docx-export\.js["']/);
  assert.match(main, /import\(["']\.\/lib\/docx-export\.js["']\)/);
});

function assertFileBudget(file, maxRawBytes, maxGzipBytes) {
  const rawBytes = statSync(file).size;
  const zippedBytes = gzipSize(file);

  assert.ok(rawBytes <= maxRawBytes, `${file} raw size ${rawBytes} presega ${maxRawBytes}`);
  assert.ok(zippedBytes <= maxGzipBytes, `${file} gzip size ${zippedBytes} presega ${maxGzipBytes}`);
}

function gzipSize(file) {
  return gzipSync(readFileSync(file), { level: 9 }).length;
}
