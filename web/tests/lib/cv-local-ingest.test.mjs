import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extractCvText, organizeCvLocally } from "../../src/lib/cv/local-ingest.mjs";

const file = (text, name) => new File([text], name);

test("PDF text is extracted locally and the temporary file is removed", async () => {
  let command;
  let input;
  const before = (await readdir(tmpdir())).filter((name) => name.startsWith("career-ops-cv-"));
  const result = await extractCvText(file("%PDF-1.7\ntest", "resume.pdf"), {
    run: async (bin, args) => { command = bin; input = args[3]; return { stdout: "Currículo de Joana\nEngenheira" }; },
  });
  assert.equal(result, "Currículo de Joana\nEngenheira");
  assert.equal(command, "pdftotext");
  assert.ok(input.endsWith("curriculo.pdf"));
  const after = (await readdir(tmpdir())).filter((name) => name.startsWith("career-ops-cv-"));
  assert.deepEqual(after, before);
});

test("DOCX XML is extracted locally without executing file content", async () => {
  const result = await extractCvText(file("PK\u0003\u0004test", "resume.docx"), {
    run: async (bin, args) => {
      assert.equal(bin, "unzip");
      assert.deepEqual(args.slice(0, 1), ["-p"]);
      return { stdout: '<w:document><w:p><w:r><w:t>Ana &amp; Bia</w:t></w:r></w:p><w:p><w:r><w:t>São Paulo</w:t></w:r></w:p></w:document>' };
    },
  });
  assert.equal(result, "Ana & Bia\nSão Paulo");
});

test("unreadable scans and invalid files fail with actionable errors", async () => {
  await assert.rejects(extractCvText(file("not a pdf", "resume.pdf")), /PDF válido/);
  await assert.rejects(extractCvText(file("%PDF-1.7", "resume.pdf"), { run: async () => ({ stdout: "   " }) }), /digitalizado/);
  await assert.rejects(extractCvText(file("a", "resume.exe")), /PDF, DOCX/);
});

test("local model receives source only at loopback, returns reviewed markdown and seed", async () => {
  const calls = [];
  const result = await organizeCvLocally("Ana Silva\nEngenheira de dados 2023-2026", {
    fetchFn: async (url, init) => {
      calls.push([url, init]);
      if (url.endsWith("/api/tags")) return Response.json({ models: [{ name: "qwen3:8b" }] });
      return Response.json({ response: JSON.stringify({ markdown: "# CV — Ana Silva\n## Experiência Profissional\nEngenheira de dados 2023-2026", seed: { title: "Engenheira de dados", roles: ["Engenheira de dados"], location: "" } }) });
    },
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(([url]) => url.startsWith("http://127.0.0.1:11434/")));
  assert.match(JSON.parse(calls[1][1].body).prompt, /Ana Silva/);
  assert.equal(result.model, "qwen3:8b");
  assert.equal(result.seed.title, "Engenheira de dados");
});

test("a local model omitting facts falls back to the original text", async () => {
  const source = "Ana Silva\nana@example.invalid\nEngenheira de dados 2022-2024";
  const result = await organizeCvLocally(source, { fetchFn: async (url) => url.endsWith("/api/tags")
    ? Response.json({ models: [{ name: "qwen3:8b" }] })
    : Response.json({ response: JSON.stringify({ markdown: "# CV\nEngenheira de dados", seed: {} }) }) });
  assert.equal(result.markdown, source);
  assert.match(result.warning, /omitiu ou inventou dados/);
});

test("a name with a Portuguese particle cannot silently disappear", async () => {
  const source = "Joana da Silva\nEngenheira de software, 2021-2025";
  const result = await organizeCvLocally(source, { fetchFn: async (url) => url.endsWith("/api/tags")
    ? Response.json({ models: [{ name: "qwen3:8b" }] })
    : Response.json({ response: JSON.stringify({ markdown: "# CV\nEngenheira de software, 2021-2025", seed: {} }) }) });
  assert.equal(result.markdown, source);
  assert.match(result.warning, /omitiu ou inventou dados/);
});

test("invented contacts and unsupported location are not accepted", async () => {
  const source = "Joana da Silva\nEngenheira de software na Exemplo S.A., 2021-2025";
  const fetchFn = async (url) => url.endsWith("/api/tags")
    ? Response.json({ models: [{ name: "qwen3:8b" }] })
    : Response.json({ response: JSON.stringify({ markdown: "# CV — Joana da Silva\nEngenheira de software na Exemplo S.A., 2021-2025\nEmail: inventado@example.com", seed: { location: "Lisboa" } }) });
  const result = await organizeCvLocally(source, { fetchFn });
  assert.equal(result.markdown, source);
  assert.deepEqual(result.seed, {});
  assert.match(result.warning, /inventou dados/);
});

test("an unavailable Ollama or missing model never falls through to a cloud CLI", async () => {
  await assert.rejects(organizeCvLocally("Currículo", { fetchFn: async () => { throw new Error("offline"); } }), /Ollama local não está disponível/);
  await assert.rejects(organizeCvLocally("Currículo", { model: "not-installed", fetchFn: async () => Response.json({ models: [{ name: "qwen3:8b" }] }) }), /Nenhum modelo local disponível/);
  await assert.rejects(organizeCvLocally("Currículo", { fetchFn: async (url) => url.endsWith("/api/tags") ? Response.json({ models: [{ name: "qwen3:8b" }] }) : Response.json({ response: "invalid json" }) }), /Não foi possível organizar/);
  await assert.rejects(organizeCvLocally("x".repeat(24001)), /excede 24 mil caracteres/);
});
