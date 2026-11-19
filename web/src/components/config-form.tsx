"use client";

import { useEffect, useState } from "react";
import {
  Check,
  KeyRound,
  TerminalSquare,
  Terminal,
  Loader2,
  CircleDashed,
  ExternalLink,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CadenceSettings } from "@/components/followups/cadence-settings";
import { persistCliId, readSavedCliId } from "@/lib/saved-cli";
import { keepIfInstalled, pickDefaultInstalled } from "@/lib/cli-pick.mjs";
import { CONFIG_KEY as STORAGE_KEY, writeConfig } from "@/lib/config-events.mjs";

type Cli = {
  id: string;
  name: string;
  run: string;
  url: string;
  installed: boolean;
  path: string | null;
  models?: string[];
};

type Mode = "cli" | "key" | "manual";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google (Gemini)" },
  { id: "openrouter", label: "OpenRouter" },
] as const;

export function ConfigForm() {
  const [mode, setMode] = useState<Mode>("cli");
  const [clis, setClis] = useState<Cli[] | null>(null);
  const [cliId, setCliId] = useState<string>("");
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [logos, setLogos] = useState(true);
  const [saved, setSaved] = useState(false);
  const [ollamaModel, setOllamaModel] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Load saved prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.mode === "cli") setMode("cli");
        if (v.cliId) setCliId(v.cliId);
        if (v.provider) setProvider(v.provider);
        if (v.ollamaModel) setOllamaModel(v.ollamaModel);
        if (typeof v.logos === "boolean") setLogos(v.logos);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Detect installed CLIs and Ollama models
  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: Cli[] = d.clis ?? [];
        setClis(list);
        const ollamaCli = list.find((c) => c.id === "ollama");
        if (ollamaCli?.models && Array.isArray(ollamaCli.models)) {
          setAvailableModels(ollamaCli.models);
          setOllamaModel((prev) => prev || (ollamaCli.models ? ollamaCli.models[0] : "") || "qwen2.5-coder-abliterated:7b");
        }
        setCliId((prev) => {
          if (keepIfInstalled(prev, list)) return prev;
          return pickDefaultInstalled(list, typeof d.remembered === "string" ? d.remembered : null) ?? "";
        });
      })
      .catch(() => setClis([]));
  }, []);

  useEffect(() => {
    if (clis && cliId && !readSavedCliId()) persistCliId(cliId);
  }, [clis, cliId]);

  function save() {
    writeConfig(localStorage, window, { mode, cliId, provider, logos, ollamaModel });
    if (ollamaModel) {
      fetch("/api/ollama/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ollamaModel }),
      }).catch(() => {});
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const installed = clis?.filter((c) => c.installed) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Configuração</h1>
      <p className="mt-1 text-sm text-muted">
        Rode o career-ops na sua própria IA, direto no seu computador. Seu currículo e seus dados nunca saem da sua máquina.
      </p>

      {/* Engine mode */}
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Motor de IA
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        <ModeCard
          active={mode === "cli"}
          onClick={() => setMode("cli")}
          icon={Terminal}
          title="Use uma ferramenta de IA que você já tem"
          hint="Recomendado"
        />
        <ModeCard
          active={mode === "key"}
          onClick={() => setMode("key")}
          icon={KeyRound}
          title="Colar uma chave de IA"
          hint="Em breve"
          disabled
        />
        <ModeCard
          active={mode === "manual"}
          onClick={() => setMode("manual")}
          icon={TerminalSquare}
          title="Sem configuração"
          hint="Em breve"
          disabled
        />
      </div>

      <div className="mt-6">
        {mode === "cli" && (
          <div>
            <p className="mb-1 text-sm text-muted">
              O career-ops usa uma ferramenta de IA que você já tem — logada, com seu próprio uso, nada para colar.
            </p>
            <p className="mb-3 text-xs text-faint">Funciona com Ollama (Modelos Locais), OpenCode, Antigravity CLI, Claude Code e outros.</p>
            {clis === null ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" /> Verificando o que está no seu computador…
              </div>
            ) : installed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
                Ainda sem ferramenta de IA? Opções gratuitas como <span className="text-foreground">Ollama</span> ou <span className="text-foreground">OpenCode</span> funcionam muito bem.{" "}
                <a href="https://ollama.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-text hover:underline">
                  Instalar Ollama <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {clis.map((c) => {
                  const selected = c.id === cliId;
                  const isOllama = c.id === "ollama";
                  const rowClassName = cn(
                    "flex flex-col rounded-xl border px-4 py-3 text-sm transition-colors",
                    selected
                      ? "border-brand/50 bg-brand-soft"
                      : c.installed
                        ? "border-border bg-surface/50"
                        : "border-border/60 bg-surface/20",
                  );

                  if (c.installed) {
                    return (
                      <div key={c.id} className={rowClassName}>
                        <button
                          type="button"
                          onClick={() => setCliId(c.id)}
                          aria-pressed={selected}
                          className="flex w-full cursor-pointer items-center gap-3 text-left"
                        >
                          <Check className="size-4 shrink-0 text-emerald-400" />
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className={cn("font-medium", selected ? "text-foreground" : "")}>
                              {c.name}
                            </span>
                            <span className="font-mono text-xs text-faint">{c.run}</span>
                          </span>
                          <span className="hidden max-w-[40%] shrink-0 truncate text-xs text-faint sm:block">
                            {c.path}
                          </span>
                        </button>

                        {isOllama && selected && availableModels.length > 0 && (
                          <div className="mt-3 ml-7 border-t border-border/40 pt-3">
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                              <Cpu className="size-3.5 text-brand-text" /> Modelo Local do Ollama:
                            </label>
                            <select
                              value={ollamaModel}
                              onChange={(e) => setOllamaModel(e.target.value)}
                              className="w-full rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-brand/50"
                            >
                              {availableModels.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] text-faint">
                              Usado automaticamente para avaliar vagas e processar currículos com 100% de privacidade.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      className={cn(rowClassName, "flex-row items-center gap-3")}
                    >
                      <CircleDashed className="size-4 shrink-0 text-faint" />
                      <button
                        type="button"
                        disabled
                        className="flex flex-1 items-center gap-2 text-left max-sm:min-h-[44px] cursor-default"
                      >
                        <span className="font-medium text-muted">
                          {c.name}
                        </span>
                        <span className="font-mono text-xs text-faint">{c.run}</span>
                      </button>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center justify-center gap-1 text-xs text-brand-text hover:underline max-sm:min-h-[44px]"
                      >
                        Instalar <ExternalLink className="size-3" />
                      </a>
                    </div>
                  );
                })}
                {installed.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-xs text-muted">
                    Nenhuma CLI compatível encontrada no seu PATH. Instale uma (por exemplo Ollama, OpenCode, Antigravity CLI, Claude Code) para começar.
                  </p>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                  O <span className="text-muted">Ollama</span> executa modelos totalmente locais e gratuitos sem necessidade de chaves de API externas.
                </p>
              </div>
            )}
          </div>
        )}

        {mode === "key" && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Provedor
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                      provider === p.id
                        ? "border-brand/50 bg-brand-soft text-foreground"
                        : "border-border bg-surface/50 text-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Colar uma chave de IA
              </label>
              <p className="mb-2 text-xs text-faint">Use uma chave da OpenAI, Anthropic e outros.</p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-surface/60 px-4 py-2.5 font-mono text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/50"
              />
              <p className="mt-2 text-xs text-faint">
                Armazenada apenas neste navegador — nunca enviada a outro lugar além do provedor escolhido.
              </p>
            </div>
          </div>
        )}

        {mode === "manual" && (
          <div className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
            O caminho mais fácil — sem chaves, nada para configurar. No roteiro.
          </div>
        )}
      </div>

      {/* Appearance / privacy */}
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Aparência
      </label>
      <button
        type="button"
        onClick={() => setLogos((v) => !v)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface/50 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Logos das empresas</span>
          <span className="mt-0.5 block text-xs text-faint">
            Mostra o logo real de cada empresa. Buscado uma vez pelo seu servidor local e armazenado em
            disco — apenas o domínio do empregador é enviado a terceiros. Desligado = somente monogramas coloridos.
          </span>
        </span>
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            logos ? "bg-brand" : "bg-surface-hover",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
              logos ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </span>
      </button>

      <CadenceSettings />

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 max-sm:min-h-[44px]"
        >
          {saved ? <Check className="size-4" /> : null}
          {saved ? "Salvo" : "Salvar configuração"}
        </button>
        <span className="text-xs text-faint">Local-first · no nosso roteiro</span>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-border bg-surface/30 opacity-55"
          : active
            ? "border-brand/50 bg-brand-soft"
            : "border-border bg-surface/50 hover:bg-surface-hover",
      )}
    >
      <Icon className={cn("size-4", active && !disabled ? "text-brand-text" : "text-muted")} />
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="text-xs text-faint">{hint}</span>
    </button>
  );
}
