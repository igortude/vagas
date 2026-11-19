#!/usr/bin/env node
/**
 * ollama-runner.mjs — headless adapter for running local Ollama models in career-ops.
 * Invoked by career-ops web or CLI via `node ollama-runner.mjs -p "prompt"`
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let prompt = "";
let model = process.env.OLLAMA_MODEL || "qwen2.5-coder-abliterated:7b";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "-p" || args[i] === "--print") {
    prompt = args[i + 1] || "";
    i++;
  } else if (args[i] === "--model" && args[i + 1]) {
    model = args[i + 1];
    i++;
  } else if (!prompt && !args[i].startsWith("-")) {
    prompt = args[i];
  }
}

// Check if this is an evaluation request with a URL
const urlMatch = prompt.match(/https?:\/\/[^\s"'`<>]+/i);
const postingUrl = urlMatch ? urlMatch[0] : "";

// If it's an evaluation, forward to ollama-eval.mjs
const evalArgs = ["ollama-eval.mjs", "--model", model];
if (postingUrl) {
  evalArgs.push("--posting-url", postingUrl);
}
evalArgs.push(prompt);

const child = spawn(process.execPath, evalArgs, {
  cwd: ROOT,
  env: process.env,
  stdio: ["inherit", "inherit", "inherit"],
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
