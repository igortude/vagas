import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, models: [] }, { status: 502 });
    }
    const data = await res.json();
    const models = (data.models || []).map((m: any) => ({
      name: m.name,
      size: m.size,
      details: m.details,
    }));
    return NextResponse.json({
      ok: true,
      models,
      defaultModel: process.env.OLLAMA_MODEL || models[0]?.name || "qwen2.5-coder-abliterated:7b",
    });
  } catch {
    return NextResponse.json({ ok: false, models: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { model } = body;
    if (typeof model === "string" && model.trim()) {
      process.env.OLLAMA_MODEL = model.trim();
      return NextResponse.json({ ok: true, model: process.env.OLLAMA_MODEL });
    }
    return NextResponse.json({ error: "Nome de modelo inválido" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar modelo" }, { status: 500 });
  }
}
