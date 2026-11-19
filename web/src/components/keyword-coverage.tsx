"use client";

import { useEffect, useState } from "react";
import { ScanSearch } from "lucide-react";
import { coverageModel, coverageBand } from "@/lib/keyword-coverage.mjs";
import type { CoverageModel } from "@/lib/keyword-coverage.mjs";

// ATS keyword coverage for this report's JD against the CV, from the core's
// keyword-match.mjs via /api/keyword-match.
//
// Sits on the report because that is where the decision is — "is my CV going to
// read as a match for this JD?" is asked while looking at the offer, not on a
// separate page.
//
// DIAGNOSTIC, and the UI has to keep it that way. There is no pass mark and no
// red state: the script's own header states the project rule that keywords get
// reformulated, never fabricated, and a failing grade is what pushes someone to
// paste the missing terms in verbatim.
const BAND_CLASS: Record<string, string> = {
  high: "text-brand-text",
  mid: "text-foreground",
  low: "text-foreground",
  unknown: "text-faint",
};

const REASON_COPY: Record<string, string> = {
  "no-keywords": "Este relatório não tem o bloco “Palavras-chave extraídas”, então não há nada para comparar com o currículo.",
  "no-script": "O keyword-match.mjs não está neste checkout do career-ops.",
  "no-report": "O arquivo do relatório não foi encontrado.",
  failed: "A checagem de palavras-chave não foi concluída.",
  unparseable: "A checagem de palavras-chave retornou algo ilegível.",
  unavailable: "A checagem de palavras-chave não está disponível.",
};

export function KeywordCoverage({ reportId }: { reportId: string }) {
  const [model, setModel] = useState<CoverageModel | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/keyword-match?report=${encodeURIComponent(reportId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setModel(coverageModel(d)))
      .catch(() => alive && setModel(coverageModel(null)));
    return () => {
      alive = false;
    };
  }, [reportId]);

  if (!model) {
    return (
      <section className="mt-8 rounded-2xl border border-border bg-surface/40 px-5 py-4">
        <div className="h-5 w-44 animate-pulse rounded bg-muted/25" aria-hidden />
        <div className="mt-3 h-16 w-full animate-pulse rounded bg-muted/25" aria-hidden />
      </section>
    );
  }

  if (!model.available) {
    // Stated, not hidden: "no keywords block" is a fact about this report that
    // tells the reader what to do next, and silently omitting the panel would
    // read as the check having passed.
    return (
      <section className="mt-8 rounded-2xl border border-border bg-surface/40 px-5 py-4">
        <Header />
        <p className="mt-2 text-sm text-muted">{REASON_COPY[model.reason ?? "unavailable"] ?? REASON_COPY.unavailable}</p>
      </section>
    );
  }

  const band = coverageBand(model.coveragePct);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <Header />

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`text-3xl tabular-nums ${BAND_CLASS[band]}`}>
          {model.coveragePct === null ? "—" : `${model.coveragePct}%`}
        </span>
        <span className="text-sm text-muted">
          {model.presentCount} de {model.total} palavra{model.total === 1 ? "" : "s"}-chave da vaga encontrada{model.total === 1 ? "" : "s"} no seu currículo
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {model.tiers.map((tier) =>
          tier.terms.length === 0 ? null : (
            <div key={tier.key}>
              <p className="text-xs uppercase tracking-wide text-faint">
                {tier.label} <span className="normal-case tracking-normal">· {tier.hint}</span>
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {tier.terms.map((term, i) => (
                  <li
                    key={`${i}:${term}`}
                    className={
                      tier.key === "missing"
                        ? "rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted"
                        : "rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground"
                    }
                  >
                    {term}
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>

      <p className="mt-4 text-xs text-faint">
        Apenas diagnóstico — nada aqui edita seu currículo. Reformule o que você realmente tem; nunca adicione uma palavra-chave que não possa
        comprovar.
      </p>
    </section>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ScanSearch className="size-4 text-brand-text" />
      <h2 className="font-display text-base text-landing">Cobertura de palavras-chave ATS</h2>
      <span className="text-xs text-faint">esta vaga vs seu currículo</span>
    </div>
  );
}
