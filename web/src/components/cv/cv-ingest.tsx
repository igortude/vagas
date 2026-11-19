"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Upload, FileText, Loader2, Check, AlertTriangle, Lock, ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { instrumentSerif } from "@/lib/fonts";
import { cvReadiness, type CvSeed } from "@/lib/cv/quality";
import { ingestErrorMessage } from "@/lib/cv/ingest-error.mjs";
import { DEFAULT_FILTERS, filtersToParams } from "@/lib/explore";

type Phase = "input" | "parsing" | "review" | "saving" | "error";

const READINESS_HINTS: Record<string, string> = {
  "That's very short — add your experience for real matches (you can save anyway).": "Seu CV está muito curto. Adicione sua experiência para encontrar vagas mais compatíveis (você já pode salvar).",
  "Looks thin — add a role or two for better matches (you can save anyway).": "Seu CV tem poucas informações. Adicione uma ou duas experiências para melhorar a busca (você já pode salvar).",
};

const STYLE = `
.co-cvdrop{position:relative;border:1.5px dashed color-mix(in srgb, var(--fg) 22%, transparent);border-radius:1rem;transition:border-color .2s,background .2s}
.co-cvdrop[data-over="true"]{border-color:hsl(26 73% 51%);background:hsl(26 73% 51% /.05)}
.co-cvtrace{animation:co-rise .4s ease both}
`;

export function CvIngest({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [paste, setPaste] = useState("");
  const [over, setOver] = useState(false);
  const [trace, setTrace] = useState("");
  const [md, setMd] = useState("");
  const [original, setOriginal] = useState("");
  const [seed, setSeed] = useState<CvSeed | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);

  const readiness = md ? cvReadiness(md) : null;

  // Local-only CV reader. The browser receives structured JSON so content
  // containing legacy <<cv:...>> markers cannot masquerade as stream control.
  const readLocally = useCallback(async (init: RequestInit, plain = false) => {
    setPhase("parsing");
    setTrace("Lendo seu CV com o Ollama local…");
    setErr("");
    try {
      const r = await fetch(plain ? "/api/cv/ingest-local?plain=1" : "/api/cv/ingest-local", init);
      const failure = await ingestErrorMessage(r);
      if (failure) {
        setErr(failure);
        setPhase("error");
        return;
      }
      const result = await r.json() as { markdown?: unknown; original?: unknown; seed?: CvSeed | null; notice?: string };
      if (typeof result.markdown !== "string" || !result.markdown.trim()) {
        setErr("Não foi possível encontrar um CV. Cole o texto ou tente extrair sem IA.");
        setPhase("error");
        return;
      }
      setMd(result.markdown);
      setOriginal(typeof result.original === "string" ? result.original : "");
      setSeed(result.seed ?? null);
      setTrace(result.notice ?? "Revise o texto antes de salvar.");
      setPhase("review");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro na transmissão");
      setPhase("error");
    }
  }, []);

  const ingestText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setErr("O conteúdo está vazio. Cole seu CV.");
      setPhase("error");
      return;
    }
    // Only the local Ollama endpoint receives pasted CV text. The configured
    // OpenCode/Arena CLI may be remote, and must not receive private CV data by
    // surprise. Reviewing the original text without AI remains an option below.
    void readLocally({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: trimmed }) });
  };

  const ingestFile = (file: File) => {
    selectedFile.current = file;
    // .md/.txt/.markdown fast path — plain text, NO CLI needed, instant.
    if (/\.(md|markdown|txt)$/i.test(file.name)) {
      file
        .text()
        .then((t) => {
          if (!t.trim()) {
            setErr("O arquivo está vazio. Cole seu CV.");
            setPhase("error");
            return;
          }
          setSeed(null);
          setMd(t.trim());
          setOriginal(t.trim());
          setTrace("Texto lido sem IA. Confira antes de salvar.");
          setPhase("review");
        })
        .catch(() => {
          setErr("Não foi possível ler o arquivo. Cole seu CV.");
          setPhase("error");
        });
      return;
    }
    // PDF/DOCX text extraction and optional organization happen on this machine.
    const form = new FormData();
    form.append("file", file);
    void readLocally({ method: "POST", body: form });
  };

  const [saveErr, setSaveErr] = useState("");
  const save = async () => {
    if (!md.trim()) {
      setSaveErr("Seu CV está vazio. Cole o conteúdo novamente.");
      return;
    }
    setSaveErr("");
    setPhase("saving");
    try {
      const r = await fetch("/api/cv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: md }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setSaveErr(d.error || "Não foi possível salvar seu CV. Tente novamente.");
        setPhase("review"); // keep the parsed CV so they don't lose it
        return;
      }
    } catch {
      setSaveErr("Não foi possível salvar seu CV. Verifique sua conexão e tente novamente.");
      setPhase("review");
      return;
    }
    onSaved?.();
    // WOW #1 — land in the Explorer with the CV-derived filters in the URL + run=1,
    // so the Explorer auto-fires the FREE scan itself (robust, no push/replaceState race).
    // GENEROUS first scan so it never comes back empty (that would kill the wow): roles
    // only + a wide 30-day window; location stays a refinement for the deepen step, NOT a
    // hard exclude (allow=[] passes everything). Recall over precision for the first reveal.
    const roles = seed?.roles?.length ? seed.roles : seed?.title ? [seed.title] : [];
    const f = { ...DEFAULT_FILTERS, ats: [...DEFAULT_FILTERS.ats], positive: roles, sinceDays: 30 };
    const qs = filtersToParams(f);
    router.push(`/explore?${qs}${qs ? "&" : ""}run=1`);
  };

  // ── INPUT ──
  if (phase === "input" || phase === "error") {
    return (
      <div className="space-y-3">
        <style>{STYLE}</style>
        <div
          className="co-cvdrop p-6"
          data-over={over}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) ingestFile(f);
          }}
        >
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && paste.trim()) ingestText(paste.trim());
            }}
            placeholder="Cole seu CV aqui ou arraste um PDF ou arquivo .md abaixo. Pode ser um rascunho: vamos organizá-lo."
            aria-label="Texto do CV"
            className="h-32 w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-faint"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/50 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-brand/40 hover:text-brand-text max-sm:min-h-[44px] max-sm:px-4"
            >
              <Upload className="size-3.5" /> Enviar PDF ou arquivo
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.md,.markdown,.txt,.docx" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) ingestFile(file); e.target.value = ""; }} />
            <span className="inline-flex items-center gap-1 text-[11px] text-faint">
              <Lock className="size-3" /> Fica no seu computador. Sua própria IA faz a leitura.
            </span>
            <button
              type="button"
              disabled={!paste.trim()}
              onClick={() => ingestText(paste.trim())}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50 max-sm:min-h-[44px]"
            >
              Ler meu CV <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
        {phase === "error" && (
          <p role="alert" className="flex items-center gap-1.5 text-[13px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5 shrink-0" /> {err}
          </p>
        )}
        {paste.trim() && (
          <button type="button" onClick={() => { setSeed(null); setMd(paste.trim()); setOriginal(paste.trim()); setTrace("Texto colado sem IA. Confira antes de salvar."); setPhase("review"); }} className="text-xs text-brand-text underline">
            Revisar texto colado sem IA
          </button>
        )}
        {phase === "error" && selectedFile.current && /\.(pdf|docx)$/i.test(selectedFile.current.name) && (
          <button type="button" onClick={() => { const form = new FormData(); form.append("file", selectedFile.current!); void readLocally({ method: "POST", body: form }, true); }} className="ml-3 text-xs text-brand-text underline">
            Extrair texto do arquivo sem IA
          </button>
        )}
      </div>
    );
  }

  // ── PARSING (the 10s bridge) ──
  if (phase === "parsing") {
    return (
      <div className="rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur-sm">
        <style>{STYLE}</style>
        <div className="flex items-center gap-2.5">
          <Loader2 className="size-4 animate-spin text-brand-text" />
          <span className={`${instrumentSerif.className} text-lg text-foreground`}>{trace || "Lendo seu CV…"}</span>
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Ollama local · sem custo de API
        </div>
        {md && <div className="co-cvtrace mt-4 max-h-40 overflow-hidden rounded-lg border border-border bg-surface/40 p-3 text-[11px] text-faint">{md.slice(0, 400)}…</div>}
      </div>
    );
  }

  // ── REVIEW (propose → confirm) ──
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-4 backdrop-blur-sm md:p-5">
      <style>{STYLE}</style>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FileText className="size-4 text-brand-text" />
        <h3 className={`${instrumentSerif.className} text-lg text-foreground`}>Seu CV está pronto para revisão. Confira e salve</h3>
        {readiness && (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              readiness.scoreable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
          >
            {readiness.scoreable ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
            {readiness.scoreable ? "Pronto para buscar vagas" : "Faltam informações"}
          </span>
        )}
      </div>
      {trace && <p role="status" className="mb-2 text-[12px] text-muted">{trace}</p>}
      {readiness?.hint && <p className="mb-2 text-[12px] text-amber-600 dark:text-amber-400">{READINESS_HINTS[readiness.hint] ?? readiness.hint}</p>}
      {saveErr && (
        <p className="mb-2 flex items-center gap-1.5 text-[12px] text-red-500">
          <AlertTriangle className="size-3.5 shrink-0" /> {saveErr}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <textarea
          value={md}
          onChange={(e) => setMd(e.target.value)}
          aria-label="Revisar e editar o CV"
          className="h-72 w-full resize-none rounded-lg border border-border bg-surface/40 p-3 font-mono text-[12px] leading-relaxed outline-none focus:border-brand/40"
        />
        <div className="prose prose-sm dark:prose-invert h-72 max-w-none [&_p]:whitespace-pre-line overflow-y-auto rounded-lg border border-border bg-surface/40 p-3 text-[13px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </div>
      </div>
      {original && original !== md && (
        <details className="mt-3 rounded-lg border border-border p-3 text-xs text-muted">
          <summary className="cursor-pointer">Comparar com o texto original extraído</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{original}</pre>
          <button type="button" className="mt-2 text-brand-text underline" onClick={() => { setMd(original); setSeed(null); }}>
            Usar o texto original
          </button>
        </details>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={phase === "saving"}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60"
        >
          {phase === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Salvar e encontrar vagas compatíveis
        </button>
        <button
          type="button"
          onClick={() => {
            setMd("");
            setOriginal("");
            setSeed(null);
            setPhase("input");
          }}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted transition hover:text-foreground"
        >
          <RotateCcw className="size-3.5" /> Recomeçar
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-faint">
          <Lock className="size-3" /> Salvo localmente em cv.md
        </span>
      </div>
    </div>
  );
}
