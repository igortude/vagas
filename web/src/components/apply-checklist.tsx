"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageFrame } from "@/components/page-frame";
import { MarkPdfReadyButton } from "@/components/mark-pdf-ready-button";
import { saveStatus } from "@/lib/pipeline-status.mjs";

type CopyItem = { label: string; text: string };
type PdfFile = { relativePath: string; downloadHref: string } | null;
type Tip = { portal: string; tip: string };

const PORTAL_TIPS_PT: Record<string, string> = {
  Workday: "Primeiro, crie uma conta no site Workday da empresa. A sessão expira, então mantenha a aba aberta enquanto cola as informações.",
  iCIMS: "Crie uma conta antes de começar. Sem ela, o formulário não salva o rascunho.",
  Greenhouse: "Não é preciso criar uma conta. Envie o PDF e depois preencha os campos abaixo.",
  Lever: "Não é preciso criar uma conta. O formulário tem uma única página.",
  Ashby: "Não é preciso criar uma conta. O formulário é curto.",
};

const PILL =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand-text max-sm:min-h-[44px] disabled:cursor-not-allowed disabled:opacity-60";

export function ApplyChecklist({
  company,
  role,
  backHref,
  reportHref,
  postingUrl,
  resume,
  cover,
  answers,
  work,
  education,
  cvMissing,
  tips,
  trackerNum,
  reportNum,
  status,
  pdfReady,
}: {
  company: string;
  role: string;
  backHref: string;
  reportHref: string;
  postingUrl: string;
  resume: PdfFile;
  cover: PdfFile;
  answers: CopyItem[];
  work: CopyItem[];
  education: string;
  cvMissing: boolean;
  tips: Tip[];
  trackerNum: string | null;
  reportNum: number | null;
  status: string;
  pdfReady: boolean;
}) {
  return (
    <PageFrame className="max-w-3xl">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand-text">
        <ArrowLeft className="size-4" /> Pipeline
      </Link>
      <header className="mt-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">Checklist da candidatura</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-landing">{company}</h1>
        {role && <p className="mt-1 text-muted">{role}</p>}
        <Link href={reportHref} className="mt-3 inline-flex text-sm text-brand-text hover:underline">
          Voltar ao relatório
        </Link>
      </header>

      <Section title="Anúncio da vaga">
        {postingUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <a href={postingUrl} target="_blank" rel="noreferrer" className={PILL}>
              Abrir <ExternalLink className="size-3.5" />
            </a>
            <CopyButton text={postingUrl} label="Copiar URL" />
            <span className="min-w-0 break-all font-mono text-xs text-faint">{postingUrl}</span>
          </div>
        ) : (
          <Empty>Esta candidatura não tem URL do anúncio.</Empty>
        )}
      </Section>

      <Section title="CV e carta de apresentação">
        <PdfRow label="CV" file={resume} empty="Não há CV no índice de PDFs deste relatório." />
        <PdfRow label="Carta de apresentação" file={cover} empty="Não há carta de apresentação no índice de PDFs deste relatório." />
      </Section>

      <Section title="Respostas da candidatura">
        {answers.length > 0 ? (
          <div className="grid gap-3">
            {answers.map((item) => (
              <CopyField key={`${item.label}:${item.text}`} item={item} />
            ))}
          </div>
        ) : (
          <Empty>Não há respostas salvas neste relatório.</Empty>
        )}
      </Section>

      <Section title="Experiência profissional">
        {cvMissing ? (
          <Empty>O arquivo cv.md não está neste espaço de trabalho.</Empty>
        ) : work.length > 0 ? (
          <div className="grid gap-3">
            {work.map((item) => (
              <CopyField key={`${item.label}:${item.text}`} item={item} />
            ))}
          </div>
        ) : (
          <Empty>O arquivo cv.md não contém experiência profissional.</Empty>
        )}
      </Section>

      <Section title="Formação">
        {cvMissing ? (
          <Empty>O arquivo cv.md não está neste espaço de trabalho.</Empty>
        ) : education ? (
          <CopyField item={{ label: "Formação", text: education }} />
        ) : (
          <Empty>O arquivo cv.md não contém uma seção de formação.</Empty>
        )}
      </Section>

      <Section title="Dicas para os portais">
        <table className="w-full text-sm">
          <caption className="sr-only">Dicas para os portais</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-faint">
              <th className="py-2 pr-4 font-medium">Portal</th>
              <th className="py-2 font-medium">Dica</th>
            </tr>
          </thead>
          <tbody>
            {tips.map((tip) => (
              <tr key={tip.portal} className="border-t border-border">
                <td className="py-2 pr-4 align-top font-medium">{tip.portal}</td>
                <td className="py-2 text-muted">{PORTAL_TIPS_PT[tip.portal] ?? tip.tip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Depois de enviar">
        <div className="flex flex-wrap items-start gap-2">
          <AppliedButton trackerNum={trackerNum} status={status} />
          <SeedButton trackerNum={trackerNum} />
          <MarkPdfReadyButton reportNum={reportNum} ready={pdfReady} />
        </div>
        {!trackerNum && <p className="mt-2 text-xs text-faint">Para marcar como enviada ou criar um acompanhamento, é preciso ter um registro no painel.</p>}
      </Section>
    </PageFrame>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function CopyField({ item }: { item: CopyItem }) {
  return (
    <div className="rounded-xl border border-border bg-surface/30 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{item.label}</p>
        <CopyButton text={item.text} label="Copiar" />
      </div>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted">{item.text}</pre>
    </div>
  );
}

function PdfRow({ label, file, empty }: { label: string; file: PdfFile; empty: string }) {
  if (!file) return <p className="mb-2 text-sm text-muted">{label}: {empty}</p>;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{label}</span>
      <a href={file.downloadHref} target="_blank" rel="noreferrer" className={PILL}>
        Baixar
      </a>
      <CopyButton text={file.relativePath} label="Copiar caminho" />
      <span className="font-mono text-xs text-faint">{file.relativePath}</span>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      className={PILL}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        window.setTimeout(() => setState("idle"), 1500);
      }}
    >
      {state === "copied" ? "Copiado" : state === "failed" ? "Falha ao copiar" : label}
    </button>
  );
}

function AppliedButton({ trackerNum, status }: { trackerNum: string | null; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const applied = status.trim().toLowerCase() === "applied";

  async function markApplied() {
    if (!trackerNum || busy || applied) return;
    setBusy(true);
    setError("");
    try {
      await saveStatus(trackerNum, status, "Applied");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível marcar a candidatura como enviada.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={PILL} disabled={!trackerNum || busy || applied} onClick={markApplied}>
        {busy ? "Salvando…" : "Candidatura enviada"}
      </button>
      {error && <span className="max-w-xs text-xs text-red-500">{error}</span>}
    </span>
  );
}

function SeedButton({ trackerNum }: { trackerNum: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function seed() {
    if (!trackerNum || busy) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/followups/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: trackerNum }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "Não foi possível criar o acompanhamento.");
        return;
      }
      setNote(body?.seeded !== false ? "Acompanhamento criado." : body?.reason === "disabled" ? "Os acompanhamentos estão desativados no seu perfil. Nenhum acompanhamento foi criado." : "O acompanhamento já foi criado.");
      router.refresh();
    } catch {
      setError("Não foi possível criar o acompanhamento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={PILL} disabled={!trackerNum || busy} onClick={seed}>
        {busy ? "Salvando…" : "Criar acompanhamento"}
      </button>
      {note && <span className="text-xs text-muted">{note}</span>}
      {error && <span className="max-w-xs text-xs text-red-500">{error}</span>}
    </span>
  );
}
