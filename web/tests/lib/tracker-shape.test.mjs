// A missing tracker, an empty table, and a file that is not a table all parse
// to zero rows. The pipeline must not tell every one of those to "clear the
// search".
//
// Run: node --test tests/lib/tracker-shape.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { classifyTracker } from "../../src/lib/tracker-table.mjs";
import { trackerEmptyMessage } from "../../src/lib/tracker-empty.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));

const HEADER = `| # | Date | Company | Via | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|-----|------|-------|--------|-----|--------|-------|
`;

const ROW = `| 1 | 2026-07-01 | Northwind Grocers | — | Analytics Engineer | 4.2/5 | Applied | — | — | fixture |
`;

test("classifyTracker separates missing, empty, and malformed files", () => {
  assert.equal(classifyTracker(null, root), "missing");
  assert.equal(classifyTracker("", root), "empty");
  assert.equal(classifyTracker("   \n", root), "empty");
  assert.equal(classifyTracker(HEADER, root), "empty");
  assert.equal(classifyTracker(HEADER.replace(/\n/g, "\r\n"), root), "empty");
  assert.equal(classifyTracker(`${HEADER}${ROW}`, root), "rows");
  assert.equal(classifyTracker("Notes from a meeting.\nCompany,Role\nNorthwind,Engineer\n", root), "malformed");
});

test("trackerEmptyMessage does not blame the search when the file has no rows", () => {
  const filtered = trackerEmptyMessage({ shape: "rows", query: "Northwind", min: null, tab: "ALL" });
  assert.equal(filtered.kind, "filtered");
  assert.match(filtered.detail, /Tente outra aba ou limpe a busca./);

  const empty = trackerEmptyMessage({ shape: "empty", query: "", min: null, tab: "ALL" });
  assert.equal(empty.kind, "empty");
  assert.equal(empty.title, "Nenhuma candidatura ainda");
  assert.doesNotMatch(empty.detail, /Tente outra aba ou limpe a busca./);

  const missing = trackerEmptyMessage({ shape: "missing", query: "", min: null, tab: "ALL" });
  assert.equal(missing.kind, "empty");

  const bad = trackerEmptyMessage({ shape: "malformed", query: "", min: null, tab: "ALL" });
  assert.equal(bad.kind, "malformed");
  assert.match(bad.detail, /tracker/);
  assert.match(bad.detail, /O arquivo não foi alterado./);
  assert.doesNotMatch(bad.detail, /Tente outra aba ou limpe a busca./);

  const tab = trackerEmptyMessage({ shape: "rows", query: "", min: null, tab: "APPLIED" });
  assert.equal(tab.kind, "filtered");
});
