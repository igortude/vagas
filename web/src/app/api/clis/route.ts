import { NextResponse } from "next/server";
import { careerOpsRoot } from "@/lib/career-ops";
import { detectClis } from "@/lib/clis";
import { readRememberedCli } from "@/lib/remembered-cli.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const clis = detectClis();

  // Detect local Ollama models
  let ollamaModels: string[] = [];
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      ollamaModels = (data.models || []).map((m: any) => m.name);
    }
  } catch {
    /* Ollama not reachable */
  }

  // Attach models to the ollama entry in clis
  const enriched = clis.map((c) => {
    if (c.id === "ollama") {
      return {
        ...c,
        installed: c.installed && ollamaModels.length > 0,
        models: ollamaModels,
      };
    }
    return c;
  });

  return NextResponse.json({ clis: enriched, remembered: readRememberedCli(careerOpsRoot()) });
}
