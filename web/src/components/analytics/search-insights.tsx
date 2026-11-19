"use client";

import { useEffect, useState } from "react";
import { statsModel } from "@/lib/analytics/view-model.mjs";
import type { StatsModel, BreakdownSection, ThresholdSection, VendorSection } from "@/lib/analytics/view-model.mjs";

const SECTION_LABELS: Record<string, string> = {
  "Quality threshold": "Nota mínima recomendada",
  "Archetype mix": "Distribuição por arquétipo",
  "Work mode": "Modelo de trabalho",
  "Company size": "Porte das empresas",
  "By ATS vendor": "Por fornecedor de ATS",
};

// The "Insights" view: analyze-patterns.mjs, rendered.
//
// The core already refuses to claim things its sample cannot support, and every
// one of those refusals is surfaced here rather than smoothed over — a panel
// that quietly drops a caveat is how a hedged number becomes a rule someone
// filters their search by. The gating lives in lib/analytics/view-model.mjs and
// is unit-tested; this file only renders the decision.
function progressMessagePtBr(message: string, current: number, threshold: number | null): string {
  if (/^Not enough data: \d+\/\d+ applications sent\. Keep applying and come back later\.$/.test(message)) {
    return `Dados insuficientes: ${current} de ${threshold} candidaturas enviadas. Continue se candidatando e volte depois.`;
  }
  if (message === "No applications found in tracker.") return "Nenhuma candidatura encontrada no rastreador.";
  return message;
}

export function SearchInsights() {
  const [model, setModel] = useState<StatsModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/patterns")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setModel(statsModel(d?.patterns ?? null)))
      .catch(() => alive && setModel(statsModel(null)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mt-6 grid gap-3" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-28 w-full animate-pulse rounded-2xl bg-muted/25" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    );
  }

  if (!model || model.state === "unavailable") {
    return (
      <Empty
        title="A análise de padrões não está disponível"
        body="Isto precisa do analyze-patterns.mjs no checkout do career-ops. Todo o resto desta página continua funcionando."
      />
    );
  }

  if (model.state === "below-threshold" && model.progress) {
    const { current, threshold, message } = model.progress;
    const pct = threshold ? Math.min(100, Math.round((current / threshold) * 100)) : 0;
    return (
      // The core's own words, plus the distance to the bar. Showing "4 of 5" is
      // the difference between "come back later" and knowing exactly when.
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-8 text-center">
        <p className="font-display text-lg text-landing">Ainda não há candidaturas suficientes</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{progressMessagePtBr(message, current, threshold)}</p>
        {threshold ? (
          <div className="mx-auto mt-5 max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-brand/70" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-faint">
              {current} de {threshold} candidaturas
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (model.sections.length === 0) {
    return <Empty title="Ainda sem padrões para mostrar" body="Isto lê os desfechos — registre alguns e eles aparecerão aqui." />;
  }

  return (
    <div className="mt-6 grid gap-4">
      {model.sections.map((section) => {
        if (section.key === "threshold") return <Threshold key="threshold" section={section as ThresholdSection} />;
        if (section.key === "vendor") return <Vendor key="vendor" section={section as VendorSection} />;
        return <Breakdown key={section.key} section={section as BreakdownSection} />;
      })}
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-base text-landing">{SECTION_LABELS[title] ?? title}</h3>
        {hint && <p className="text-xs text-faint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-10 text-center">
      <p className="font-display text-lg text-landing">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}

function thresholdNotePtBr(note: string): string {
  if (note === "No positive outcome carries a score yet.") return "Nenhum resultado positivo tem nota ainda.";
  let match = note.match(/^Lowest score among positive outcomes so far is ([\d.]+), but only (\d+) positive outcome\(s\) carry a score \((\d+) needed before this is a threshold\)\.$/);
  if (match) return `A menor nota entre os resultados positivos até agora é ${match[1]}, mas apenas ${match[2]} têm nota (são necessários ${match[3]} para definir um corte).`;
  match = note.match(/^Lowest score among (\d+) positive outcomes is ([\d.]+), but no rejected application scored below it — nothing shows that lower scores fail\.$/);
  if (match) return `A menor nota entre ${match[1]} resultados positivos é ${match[2]}, mas nenhuma candidatura rejeitada teve nota inferior — não há evidência de que notas menores não funcionem.`;
  match = note.match(/^None of the (\d+) positive outcomes scored below ([\d.]+), and (\d+) rejected application\(s\) did\.$/);
  if (match) return `Nenhum dos ${match[1]} resultados positivos teve nota abaixo de ${match[2]}, enquanto ${match[3]} candidaturas rejeitadas tiveram.`;
  return note;
}

function Threshold({ section }: { section: ThresholdSection }) {
  return (
    <Panel title={section.label} hint={section.sampleSize ? `${section.sampleSize} desfechos decididos` : undefined}>
      <p className="mt-2 text-3xl tabular-nums text-foreground">
        {/* Withheld when the core says the sample does not support it: a
            "recommended 4.7" off three outcomes reads as a rule. */}
        {section.value === null ? <span className="text-faint">—</span> : section.value.toFixed(1)}
      </p>
      {section.provisional && (
        <p className="mt-1 text-xs text-muted">Poucos desfechos decididos para recomendar um corte ainda.</p>
      )}
      {section.note && <p className="mt-2 text-sm text-muted">{thresholdNotePtBr(section.note)}</p>}
    </Panel>
  );
}

function Breakdown({ section }: { section: BreakdownSection }) {
  const top = Math.max(1, ...section.rows.map((r) => Number(r.total) || 0));
  return (
    <Panel title={section.label} hint={section.partial ? "algumas linhas não têm valor registrado" : undefined}>
      <div className="mt-3 grid gap-2">
        {section.rows.map((row, i) => {
          const label = String(row[section.dimension] ?? "—");
          const total = Number(row.total) || 0;
          // `Number(null)` is 0, so the absent rate the model sends for a bucket
          // nothing was submitted from would render as "0%" — the vendor rows'
          // guard, below.
          const conv = row.conversionRate == null ? null : Number(row.conversionRate);
          return (
            <div key={`${label}-${i}`} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm text-muted" title={label}>
                {label}
              </span>
              <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-brand/60" style={{ width: `${(total / top) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums">{total}</span>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-faint">
                {conv !== null && Number.isFinite(conv) ? `${conv}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Vendor({ section }: { section: VendorSection }) {
  if (!section.claimable) {
    return (
      <Panel title={section.label}>
        {/* No chart at all, and the reason stated. An advance rate over 0
            identified applications is not a small number, it is no number. */}
        <p className="mt-2 text-sm text-muted">
          {section.identified} das candidaturas puderam ser associadas a um fornecedor de ATS
          {section.minSampleForClaim ? `, e ${section.minSampleForClaim} são necessárias para que uma taxa por fornecedor signifique algo` : ""}.
        </p>
      </Panel>
    );
  }
  const top = Math.max(1, ...section.rows.map((r) => Number(r.submitted ?? r.total) || 0));
  return (
    <Panel title={section.label} hint={`${section.coveragePct}% das candidaturas identificadas`}>
      <div className="mt-3 grid gap-2">
        {section.rows.map((row, i) => {
          const label = String(row.vendor ?? "—");
          const n = Number(row.submitted ?? row.total) || 0;
          // `Number(null)` is 0, and 0 is finite, so a nulled rate would have
          // rendered as a confident "0%" — the opposite of absent.
          const rate = row.advanceRate == null ? null : Number(row.advanceRate);
          const provisional = row.provisional === true;
          return (
            <div key={`${label}-${i}`} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm text-muted">{label}</span>
              <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-brand/60" style={{ width: `${(n / top) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums">{n}</span>
              <span
                className="w-12 shrink-0 text-right text-xs tabular-nums text-faint"
                title={provisional && section.minSampleForClaim
                  ? `Menos de ${section.minSampleForClaim} candidaturas por este fornecedor, então nenhuma taxa é afirmada ainda`
                  : undefined}
              >
                {rate !== null && Number.isFinite(rate) ? `${rate}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>
      {section.citation && <p className="mt-3 text-xs text-faint">{section.citation}</p>}
    </Panel>
  );
}
