"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileText, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { arrange, renderBlocks, type BlockTree } from "@/lib/cv-studio/html-blocks.mjs";
import { emptyEdits, resolveStudio, studioReducer, type StudioAction, type StudioDoc, type StudioEdits } from "@/lib/cv-studio/studio.mjs";
import { SectionCard } from "./section-card";
import { CvPreview } from "./cv-preview";
import { CoverageMeter } from "./coverage-meter";

type Loaded = { ok: true; reportNum: string; company: string; file: string; tree: BlockTree; doc: StudioDoc; edits: StudioEdits; stale: boolean; hasBase: boolean };
type LoadState = { kind: "loading" } | { kind: "error"; reason: string } | { kind: "ready"; data: Loaded };
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; pdf: string; indexed: boolean; warnings: string[] } | { kind: "failed"; error: string };

const REASONS: Record<string, { title: string; body: string }> = {
  "no-tailored-cv": { title: "Ainda sem currículo adaptado", body: "Gere um currículo adaptado pela página do relatório primeiro. O Estúdio o abre para revisão quando ele existir." },
  "unreadable-layout": { title: "Este layout de currículo ainda não é suportado", body: "O Estúdio lê currículos gerados pelos templates do career-ops. Abra o PDF pela página do relatório." },
  "no-report": { title: "Relatório não encontrado", body: "Não há relatório de avaliação com este número." },
};

const STALE = "Este currículo foi regerado em outra aba. Recarregue o Estúdio.";
const SAVE_ERRORS: Record<string, string> = { stale: STALE, busy: "Este currículo já está sendo salvo. Espere esse salvamento terminar." };

export function CvStudio({ n }: { n: string }) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    fetch(`/api/cv-studio/${encodeURIComponent(n)}`)
      .then(async (r) => (r.ok ? { kind: "ready" as const, data: (await r.json()) as Loaded } : { kind: "error" as const, reason: ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "failed" }))
      .catch(() => ({ kind: "error" as const, reason: "failed" }))
      .then((s) => live && setLoad(s));
    return () => {
      live = false;
    };
  }, [n]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <Link href={`/pipeline/${n}`} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand-text">
        <ArrowLeft className="size-4" /> Relatório nº {n}
      </Link>
      {load.kind === "loading" && <div className="mt-6 h-[70vh] animate-pulse rounded-2xl bg-muted/15" aria-label="Carregando o Estúdio de Currículo" />}
      {load.kind === "error" && (
        <div className="mt-8 max-w-xl rounded-2xl border border-border bg-surface/40 px-6 py-5">
          <h1 className="font-display text-xl text-landing">{REASONS[load.reason]?.title ?? "O Estúdio de Currículo não conseguiu abrir este currículo"}</h1>
          <p className="mt-2 text-sm text-muted">{REASONS[load.reason]?.body ?? "Recarregue a página para tentar de novo."}</p>
        </div>
      )}
      {load.kind === "ready" && <Studio n={n} data={load.data} />}
    </div>
  );
}

function Studio({ n, data }: { n: string; data: Loaded }) {
  const { doc, tree } = data;
  const [edits, dispatch] = useReducer((e: StudioEdits, a: StudioAction) => studioReducer(e, a, doc), data.edits);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const resolved = useMemo(() => resolveStudio(doc, edits), [doc, edits]);
  const html = useMemo(() => renderBlocks(tree, resolved.view, { added: resolved.added }), [tree, resolved]);
  const tailoredPresent = useMemo(() => resolveStudio(doc, emptyEdits(doc.sourceHash)).coverage.present, [doc]);
  const dropped = tailoredPresent.filter((k) => resolved.coverage.missing.includes(k));

  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const send = useCallback(
    (method: "PUT" | "POST", body: object) => {
      const sent = queue.current.then(() => fetch(`/api/cv-studio/${encodeURIComponent(n)}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      queue.current = sent.catch(() => {});
      return sent;
    },
    [n],
  );

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSave((s) => (s.kind === "saved" ? { kind: "idle" } : s));
    const t = setTimeout(() => {
      send("PUT", { edits })
        .then((r) => setAutosaveError(r.ok ? null : r.status === 409 ? STALE : "Falha no salvamento automático. Suas últimas alterações ainda não foram salvas."))
        .catch(() => setAutosaveError("Falha no salvamento automático. O painel ainda está rodando?"));
    }, 500);
    return () => clearTimeout(t);
  }, [edits, send]);

  const saveForApply = useCallback(async () => {
    setSave({ kind: "saving" });
    try {
      const r = await send("POST", { op: "save", edits });
      const body = (await r.json()) as { pdf?: string; indexed?: boolean; warnings?: string[]; error?: string };
      setSave(r.ok && body.pdf ? { kind: "saved", pdf: body.pdf, indexed: body.indexed === true, warnings: body.warnings ?? [] } : { kind: "failed", error: SAVE_ERRORS[body.error ?? ""] ?? body.error ?? "O salvamento falhou." });
    } catch {
      setSave({ kind: "failed", error: "O salvamento falhou. O painel ainda está rodando?" });
    }
  }, [edits, send]);

  const changed = doc.sections.flatMap((s) => s.items.flatMap((i) => i.bullets)).filter((b) => b.change !== "same").length;

  return (
    <>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">Estúdio de Currículo</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-landing">{data.company}</h1>
          <p className="mt-1 text-sm text-muted">
            {changed} {changed === 1 ? "mudança" : "mudanças"} em relação ao seu currículo base. Revise cada uma, depois salve a versão que vai enviar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Tamanho" value={edits.preset.length} options={[["full", "Completo"], ["one-page", "Uma página"]]} onChange={(v) => dispatch({ type: "preset", preset: { length: v as "full" | "one-page" } })} />
          <Segmented label="Tom" value={edits.preset.tone} options={[["tailored", "Adaptado"], ["conservative", "Conservador"]]} onChange={(v) => dispatch({ type: "preset", preset: { tone: v as "tailored" | "conservative" } })} />
          <button onClick={() => dispatch({ type: "reset" })} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand/40 hover:text-brand-text">
            <RotateCcw className="size-3.5" /> Redefinir
          </button>
          <button
            onClick={saveForApply}
            disabled={save.kind === "saving"}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {save.kind === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar para candidatura
          </button>
        </div>
      </header>

      {data.stale && <Notice tone="warn">Este currículo foi regerado desde sua última visita, então as edições anteriores foram limpas.</Notice>}
      {!data.hasBase && <Notice tone="warn">Nenhum cv.md encontrado, então as mudanças não podem ser comparadas com seu currículo base.</Notice>}
      {save.kind === "saved" && (
        <Notice tone={save.indexed ? "ok" : "warn"}>
          {save.indexed ? (
            <>
              Salvo. A candidatura agora envia esta versão.{" "}
              <a href={`/api/cv-pdf?n=${encodeURIComponent(data.reportNum)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline">
                <FileText className="size-3.5" /> Abrir {save.pdf}
              </a>
            </>
          ) : (
            <>Salvo {save.pdf}, mas data/pdf-index.tsv não foi atualizado, então a candidatura ainda envia o PDF anterior.</>
          )}
          {save.warnings.filter((w) => !/cv-facts\.json/.test(w)).map((w) => (
            <span key={w} className="mt-1 block text-xs opacity-80">{w}</span>
          ))}
        </Notice>
      )}
      {save.kind === "failed" && <Notice tone="error">{save.error}</Notice>}
      {autosaveError && <Notice tone="error">{autosaveError}</Notice>}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <CoverageMeter coverage={resolved.coverage} dropped={dropped} />
          {arrange(doc.sections, edits.order.root).map((s, k, all) => (
            <SectionCard key={s.id} n={n} section={s} edits={edits} hidden={resolved.view.hidden} dispatch={dispatch} siblings={all.map((x) => x.id)} first={k === 0} last={k === all.length - 1} />
          ))}
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <CvPreview html={html} />
        </div>
      </div>
    </>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-border p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-full px-3 py-1 text-xs transition-colors", value === v ? "bg-brand-soft font-medium text-brand-text" : "text-muted hover:text-foreground")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "warn" | "error"; children: React.ReactNode }) {
  const styles = {
    ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    error: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300",
  }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={cn("mt-4 rounded-xl border px-4 py-2.5 text-sm", styles)}>{children}</div>;
}
