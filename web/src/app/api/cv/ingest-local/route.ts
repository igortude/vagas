import { CvIngestError, extractCvText, organizeCvLocally } from "@/lib/cv/local-ingest.mjs";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint is deliberately separate from the agent-CLI route. It calls
// only Ollama on loopback; no CV text is sent to the configured cloud CLI.
export async function POST(req: Request) {
  try {
    const type = req.headers.get("content-type") ?? "";
    let text: string;
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "Selecione um arquivo de currículo." }, { status: 400 });
      text = await extractCvText(file);
    } else if (type.includes("application/json")) {
      const body = await readJsonObject<{ text?: unknown }>(req);
      if (!body) return Response.json({ error: "JSON inválido." }, { status: 400 });
      text = typeof body.text === "string" ? body.text : "";
    } else {
      return Response.json({ error: "Formato de requisição não aceito." }, { status: 415 });
    }
    if (!text.trim()) return Response.json({ error: "O currículo está vazio. Cole o texto ou escolha outro arquivo." }, { status: 400 });
    if (req.url && new URL(req.url).searchParams.get("plain") === "1") {
      return Response.json({ markdown: text.trim(), original: text.trim(), seed: null, notice: "Texto extraído localmente, sem IA. Revise e organize antes de salvar." }, { headers: { "Cache-Control": "no-store" } });
    }
    const { markdown, seed, model, warning } = await organizeCvLocally(text);
    return Response.json({ markdown, original: text.trim(), seed, notice: warning ?? `Lido com Ollama (${model}), neste computador. Compare com o original antes de salvar.` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CvIngestError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Não foi possível ler o currículo. Tente novamente ou cole o texto." }, { status: 500 });
  }
}
