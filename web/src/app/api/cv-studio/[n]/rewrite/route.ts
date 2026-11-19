import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/json-body";
import { keywordsInText, loadStudio, unsupportedRewriteClaims } from "@/lib/cv-studio/server";
import { runRewrite } from "@/lib/cv-studio/rewrite-run";
import { buildRewritePrompt, MAX_INSTRUCTION, parseRewrite } from "@/lib/cv-studio/rewrite.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

type RouteContext = { params: Promise<{ n: string }> };

const MESSAGES = {
  "no-cli": "Nenhuma CLI de IA configurada. Escolha uma na Configuração, ou edite o texto à mão.",
  unfenced: "Esta CLI de IA não pode ser limitada a acesso somente leitura, então a reescrita não rodou. Escolha Claude, Codex ou Grok na Configuração, ou edite o texto à mão.",
  refused: "A CLI de IA não pôde ser iniciada com acesso somente leitura, então nada rodou.",
  failed: "A CLI de IA não terminou. Confira se ela está autenticada e tente de novo.",
  "no-answer": "A CLI de IA respondeu sem um bullet utilizável. Tente outra instrução.",
  unsupported: "A reescrita foi descartada porque adiciona afirmações que este bullet não sustenta:",
} as const;

export async function POST(req: Request, { params }: RouteContext) {
  const n = (await params).n;
  const body = await readJsonObject<{ bulletId?: unknown; instruction?: unknown; cliId?: unknown }>(req);
  if (!body || typeof body.bulletId !== "string" || typeof body.instruction !== "string" || typeof body.cliId !== "string") {
    return NextResponse.json({ error: "Informe o identificador do tópico, a instrução e o identificador da CLI" }, { status: 400 });
  }
  const instruction = body.instruction.trim().slice(0, MAX_INSTRUCTION);
  if (!instruction) return NextResponse.json({ error: "Diga como o bullet deve mudar." }, { status: 400 });

  const load = await loadStudio(n);
  if (!load.ok) return NextResponse.json({ error: load.reason }, { status: 404 });
  const bullet = load.doc.sections.flatMap((s) => s.items.flatMap((i) => i.bullets)).find((b) => b.id === body.bulletId);
  if (!bullet) return NextResponse.json({ error: "Tópico não encontrado" }, { status: 404 });

  const run = await runRewrite(body.cliId, buildRewritePrompt({ instruction, base: bullet.base, tailored: bullet.tailored, keywords: load.doc.keywords }));
  if (!run.ok) {
    if (run.detail) console.error(`cv-studio rewrite ${run.reason}: ${run.detail}`);
    return NextResponse.json({ error: MESSAGES[run.reason] }, { status: 502 });
  }
  const text = parseRewrite(run.reply);
  if (!text) return NextResponse.json({ error: MESSAGES["no-answer"] }, { status: 422 });
  const claims = await unsupportedRewriteClaims(text, [bullet.base, bullet.tailored].filter((t) => t !== null).join("\n"));
  if (claims.length) return NextResponse.json({ error: `${MESSAGES.unsupported} ${claims.join(", ")}.`, claims }, { status: 422 });
  return NextResponse.json({ text, keywords: (await keywordsInText(n, text)) ?? [], warning: run.warning });
}
