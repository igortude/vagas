import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("first-run home does not claim no setup", () => {
  const src = readFileSync(join(root, "src/components/home/first-run-home.tsx"), "utf8");
  assert.doesNotMatch(src, /No setup/);
  assert.match(src, /Ollama organiza o currículo neste computador/);
});

test("pasted CV uses local Ollama, with a no-AI review option", () => {
  const src = readFileSync(join(root, "src/components/cv/cv-ingest.tsx"), "utf8");
  assert.match(src, /\/api\/cv\/ingest-local/);
  assert.doesNotMatch(src, /\/api\/cv\/ingest"/);
  assert.match(src, /Revisar texto colado sem IA/);
  assert.match(src, /setSeed\(null\)/);
});
