"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { FileText, Loader2, Mail, RotateCcw, TriangleAlert } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";
import { pdfButtonState } from "@/lib/pdf-button-state.mjs";
import { COVER_TONES } from "@/lib/cover-tones.mjs";

// Fires the real career-ops `cover` mode (worker kind "cover") for THIS
// application. cover.md will not draft until the candidate answers its four
// Step 6 prompts, so the button opens those questions first. The draft lands in
// the run log. Rendering it to PDF is still the CLI's Step 9.
const QUESTIONS = [
  { name: "why", label: "Por que esta vaga ou empresa?", hint: "Mencione um ou dois motivos: porte, missão, fase da empresa ou o que você gostaria de aprender." },
  { name: "problem", label: "Que problema você ajudaria a resolver?", hint: "A pesquisa compara sua resposta com o que a empresa divulga publicamente." },
  { name: "approach", label: "Como você começaria a resolver esse problema?", hint: "Escreva uma ou duas frases. Esta é a parte mais específica da carta." },
] as const;

const TONE_LABELS: Record<string, string> = {
  formal: "Formal",
  direct: "Direto",
  conversational: "Conversacional",
  mirror: "No estilo da descrição da vaga",
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand/50 focus:outline-none";

export function CoverDraftButton({ n, company }: { n: string; company: string }) {
  const { jobs, startJob } = useJobs();
  const [open, setOpen] = useState(false);
  const [savedBrief, setSavedBrief] = useState<Record<string, string> | null>(null);
  const job = useMemo(
    () => jobs.filter((j) => j.kind === "cover" && j.input === n).sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs, n],
  );
  // A cover run can finish with VERDICT 1/5 and no letter. Only treat a real
  // draft as ready; weak verdicts surface as a retry failure beside the form.
  const base = pdfButtonState(job, false);
  const weakDraft = job?.status === "done" && job.result?.score != null && job.result.score < 2;
  const state = weakDraft
    ? {
        kind: "idle" as const,
        failure: {
          jobId: job.id,
          reason: job.result?.summary || "A geração terminou sem produzir um rascunho utilizável.",
        },
      }
    : base;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const brief = Object.fromEntries(["why", "problem", "approach", "tone"].map((k) => [k, String(data.get(k) ?? "")]));
    setSavedBrief(brief);
    startJob({ title: `Carta de apresentação · ${company}`, subtitle: "rascunho para esta vaga", kind: "cover", input: n, page: `/pipeline/${n}`, brief });
    setOpen(false);
  };

  if (state.kind === "running")
    return (
      <Link href={`/jobs/${state.jobId}`} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-3 py-1 text-xs font-medium text-brand-text max-sm:min-h-[44px]">
        <Loader2 className="size-3.5 motion-safe:animate-spin" /> Escrevendo a carta de apresentação…
      </Link>
    );

  return (
    <>
      {state.kind === "ready" && job ? (
        <span className="inline-flex items-center gap-1">
          <Link
            href={`/jobs/${job.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-400 max-sm:min-h-[44px]"
          >
            <FileText className="size-3.5" /> Ver rascunho da carta
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            title="Escrever a carta de apresentação novamente"
            aria-expanded={open}
            className="inline-flex items-center justify-center rounded-full p-1 text-faint transition-colors hover:text-brand-text max-sm:min-h-[44px] max-sm:min-w-[44px]"
          >
            <RotateCcw className="size-3" />
          </button>
        </span>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand-text max-sm:min-h-[44px]"
          title="Escrever uma carta de apresentação para esta vaga com sua CLI de IA"
        >
          <Mail className="size-3.5" /> Escrever carta de apresentação
        </button>
      )}
      {state.failure && (
        <Link
          href={`/jobs/${state.failure.jobId}`}
          role="alert"
          title="Abrir o registro da execução"
          className="inline-flex max-w-md items-start gap-1 text-xs text-red-700 hover:underline dark:text-red-400"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>A carta de apresentação não foi gerada. {state.failure.reason}</span>
        </Link>
      )}
      {open && (
        <form onSubmit={submit} aria-label="Perguntas para a carta de apresentação" className="basis-full rounded-2xl border border-border bg-surface/50 p-4">
          {QUESTIONS.map((q) => (
            <label key={q.name} className="mb-3 block text-sm font-medium text-foreground">
              {q.label}
              <span className="block text-xs font-normal text-muted">{q.hint}</span>
              <textarea name={q.name} required maxLength={1000} rows={2} defaultValue={savedBrief?.[q.name] ?? ""} className={fieldClass} />
            </label>
          ))}
          <label className="mb-4 block text-sm font-medium text-foreground">
            Tom
            <select name="tone" defaultValue={savedBrief?.tone ?? "mirror"} className={fieldClass}>
              {Object.entries(COVER_TONES).map(([id, label]) => (
                <option key={id} value={id}>{TONE_LABELS[id] ?? label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand-200 max-sm:min-h-[44px]">
              <Mail className="size-3.5" /> Escrever carta
            </button>
            <CostBadge kind="spend" size="xs" />
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-brand-text max-sm:min-h-[44px]">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </>
  );
}
