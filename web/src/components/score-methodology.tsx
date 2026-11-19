import { ChevronDown, ExternalLink } from "lucide-react";

// Transparency = our differentiator ("why it's a 4.0 for YOU"). The wording is
// the CANONICAL public text from career-ops.org/methodology + /docs — rendered
// verbatim, NOT a web reinterpretation of the rubric (whose weights live in the
// core, modes/_shared.md). Native <details> → no client JS.

const DIMENSIONS: [string, string][] = [
  ["Aderência", "o quanto seu currículo corresponde aos requisitos da vaga"],
  ["Alinhamento com o objetivo", "o quanto a vaga te aproxima da sua meta de carreira declarada"],
  ["Remuneração", "a oferta vs as taxas de mercado (diz “dados insuficientes” quando falta remuneração — nunca inventa números)"],
  ["Sinais culturais", "sinais de time, valores e forma de trabalho vindos da vaga"],
  ["Alertas", "avisos de vaga fantasma, golpe ou incompatibilidade"],
  ["Geral", "o julgamento único que condensa tudo acima na nota"],
];

const BLOCKS: [string, string][] = [
  ["A", "Resumo da vaga em linguagem simples"],
  ["B", "Uma tabela de como seu currículo atende cada requisito, o peso de cada requisito nesta vaga e as lacunas"],
  ["C", "Estratégia — como se posicionar para esta vaga"],
  ["D", "Pesquisa de remuneração, comparando a oferta com as taxas de mercado"],
  ["E", "Notas de personalização para sua candidatura"],
  ["F", "Preparação para entrevista — histórias STAR adaptadas a esta vaga"],
  ["G", "Legitimidade da vaga — uma checagem de que o anúncio é real, não um golpe ou vaga fantasma"],
];

export function ScoreMethodology() {
  return (
    <details className="group mt-10 overflow-hidden rounded-2xl border border-border bg-surface/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors hover:bg-surface-hover">
        Como o career-ops avaliou isto — e por que é para <span className="text-landing">você</span>
        <ChevronDown className="ml-auto size-4 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-border px-5 py-4 text-sm">
        <p className="text-muted">
          Cada vaga recebe uma nota <strong className="text-foreground">1.0–5.0</strong> em seis dimensões.{" "}
          <strong className="text-brand-text">4.0</strong> é a linha de candidatar / não candidatar — abaixo dela, o career-ops
          recomenda não se candidatar.
        </p>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-faint">As seis dimensões</div>
          <ul className="space-y-1.5">
            {DIMENSIONS.map(([k, v]) => (
              <li key={k}>
                <span className="font-medium text-foreground">{k}</span> <span className="text-muted">— {v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-faint">O que significa cada bloco do relatório</div>
          <ul className="space-y-2">
            {BLOCKS.map(([k, v]) => (
              <li key={k} className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-semibold text-brand-text">
                  {k}
                </span>
                <span className="text-muted">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <a
          href="https://career-ops.org/methodology"
          target="_blank"
          rel="noreferrer"
          aria-label="Metodologia completa (abre em nova aba)"
          className="inline-flex min-h-[24px] items-center gap-1 text-xs text-brand-text transition-colors hover:underline max-sm:min-h-[44px]"
        >
          Metodologia completa <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
    </details>
  );
}
