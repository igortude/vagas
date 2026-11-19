"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  History,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { scanSuccessLabel } from "@/lib/scan-success.mjs";
import { CreateJobModal } from "./scheduled-scans/create-job-modal";
import { EditJobModal } from "./scheduled-scans/edit-job-modal";
import { JobCard } from "./scheduled-scans/job-card";
import { RunHistoryDrawer } from "./scheduled-scans/run-history-drawer";
import type { ScheduledJob, JobRun } from "@/lib/scheduled-jobs";
import { instrumentSerif } from "@/lib/fonts";
import { updateScheduledJobRequest } from "@/lib/scheduled-job-client.mjs";
import { isSchedulerStatusPayload } from "@/lib/scheduled-scheduler-status.mjs";

type Store = { jobs: ScheduledJob[]; runs: JobRun[] };
type SchedulerStatus = {
  platform: "win32" | "darwin" | "linux" | string;
  available: boolean;
  running: boolean;
  task: { exists: boolean; enabled: boolean; nextRun: string | null; lastRun: string | null };
};

function formatTaskTime(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

const OS_SCHEDULERS: Record<string, { title: string; install: string } | undefined> = {
  win32: { title: "Integração com o Agendador de Tarefas do Windows", install: "web/scripts/install-scan-schedule.ps1" },
  darwin: { title: "Integração com o launchd do macOS", install: "sh web/scripts/install-scan-schedule.sh" },
  linux: { title: "Integração com o cron do Linux", install: "sh web/scripts/install-scan-schedule.sh" },
};

export function ScheduledJobsView() {
  const [store, setStore] = useState<Store>({ jobs: [], runs: [] });
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "paused">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [osRunning, setOsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsResponse, schedulerResponse] = await Promise.all([
        fetch("/api/scheduled-jobs", { cache: "no-store" }),
        fetch("/api/scheduler", { cache: "no-store" }),
      ]);
      const resJobs = await jobsResponse.json().catch(() => ({}));
      const resScheduler = await schedulerResponse.json().catch(() => null);
      if (!jobsResponse.ok) throw new Error(resJobs.error || "Não foi possível carregar as buscas agendadas.");
      if (!schedulerResponse.ok && resScheduler?.error) setError(resScheduler.error);
      setStore({
        jobs: Array.isArray(resJobs.jobs) ? resJobs.jobs : [],
        runs: Array.isArray(resJobs.runs) ? resJobs.runs : [],
      });
      if (schedulerResponse.ok && isSchedulerStatusPayload(resScheduler)) setScheduler(resScheduler as SchedulerStatus);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as buscas agendadas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await updateScheduledJobRequest(id, { status: nextStatus });
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a busca agendada.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza de que deseja excluir esta busca agendada?")) return;
    try {
      const response = await fetch(`/api/scheduled-jobs/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "Não foi possível excluir a busca agendada.");
        return;
      }
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a busca agendada.");
    }
  };

  const handleTriggerOsScheduler = async () => {
    setOsRunning(true);
    try {
      const response = await fetch("/api/scheduler", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível iniciar o agendador.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o agendador.");
    } finally {
      setOsRunning(false);
    }
  };

  const jobsList = store.jobs.filter((j) => j.status !== "deleted");
  const activeJobs = jobsList.filter((j) => j.status === "active");
  const pausedJobs = jobsList.filter((j) => j.status === "paused");

  const filteredJobs = jobsList
    .filter((j) => {
      if (filterTab === "active") return j.status === "active";
      if (filterTab === "paused") return j.status === "paused";
      return true;
    })
    .filter((j) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        j.name.toLowerCase().includes(q) ||
        (j.filters?.positive || []).some((kw) => kw.toLowerCase().includes(q))
      );
    });

  const totalRuns = store.runs.length;
  const successRuns = store.runs.filter((r) => r.state === "success").length;
  const failedRuns = store.runs.filter((r) => r.state === "failed").length;
  const totalRolesFound = store.runs.reduce((acc, r) => acc + (r.rolesFound || 0), 0);
  const successRate = scanSuccessLabel(totalRuns, successRuns);

  const osScheduler = scheduler ? OS_SCHEDULERS[scheduler.platform] : undefined;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 space-y-8">
      {/* Header matching Explore & Portals format */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <CalendarClock className="size-6 text-brand-text" />
            <h1 className={`${instrumentSerif.className} text-3xl text-foreground`}>Buscas agendadas</h1>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Buscas automáticas recorrentes, com opções sem uso de tokens ou de varredura completa das plataformas de recrutamento (ATS).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-lg transition-all hover:bg-brand-200"
          >
            <CalendarPlus className="size-4" />
            Nova busca agendada
          </button>
          <button
            type="button"
            onClick={() => setHistoryDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            <History className="size-4 text-brand-text" />
            Histórico de execuções ({store.runs.length})
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface/60 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            title="Atualizar lista"
            aria-label="Atualizar lista de buscas agendadas"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin text-brand-text" : ""}`} />
          </button>
        </div>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>}

      {/* Stats Cards */}
      <div className="grid gap-3.5 sm:grid-cols-4">
        <StatCard label="Buscas ativas" value={activeJobs.length} subtitle={`${jobsList.length} buscas no total`} icon={<Zap className="size-4 text-emerald-500" />} />
        <StatCard label="Execuções realizadas" value={totalRuns} subtitle={`${successRuns} concluídas com sucesso`} icon={<Layers className="size-4 text-brand-text" />} />
        <StatCard label="Vagas encontradas" value={totalRolesFound} subtitle="Adicionadas ao pipeline" icon={<Sparkles className="size-4 text-amber-500" />} />
        <StatCard label="Taxa de sucesso" value={successRate} subtitle={`${failedRuns} execuções com falha`} icon={<CheckCircle2 className="size-4 text-emerald-500" />} />
      </div>

      {/* OS Task Scheduler Banner */}
      {scheduler && (
        <div className="co-rise rounded-2xl border border-border bg-surface/40 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-surface-hover text-brand-text">
                <Clock className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {osScheduler?.title ?? "Buscas manuais"}
                  <span
                    className={
                      scheduler.task.exists && scheduler.task.enabled
                        ? "rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                        : "rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                    }
                  >
                    {!osScheduler
                      ? "Sem agendamento automático"
                      : scheduler.task.exists
                        ? scheduler.task.enabled ? "Tarefa ativada" : "Tarefa desativada"
                        : "Tarefa não instalada"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {!osScheduler
                    ? "O agendamento automático não está disponível nesta plataforma."
                    : scheduler.task.exists
                      ? "Próxima verificação do sistema: " + formatTaskTime(scheduler.task.nextRun) + " · Última verificação do sistema: " + formatTaskTime(scheduler.task.lastRun)
                      : `Execute ${osScheduler.install} para iniciar automaticamente as buscas no horário agendado.`}
                </div>
              </div>
            </div>
            {osScheduler && <button
              type="button"
              onClick={handleTriggerOsScheduler}
              disabled={osRunning || scheduler.running || !scheduler.available}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              {osRunning ? <Loader2 className="size-3.5 animate-spin text-brand-text" /> : <Zap className="size-3.5 text-brand-text" />}
              {osRunning ? "Verificando…" : "Verificar buscas pendentes agora"}
            </button>}
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface/60 p-1">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              filterTab === "all" ? "bg-brand text-brand-foreground shadow" : "text-muted hover:text-foreground"
            }`}
          >
            Todas as buscas ({jobsList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("active")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              filterTab === "active" ? "bg-brand text-brand-foreground shadow" : "text-muted hover:text-foreground"
            }`}
          >
            Ativas ({activeJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("paused")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              filterTab === "paused" ? "bg-brand text-brand-foreground shadow" : "text-muted hover:text-foreground"
            }`}
          >
            Pausadas ({pausedJobs.length})
          </button>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-2.5 size-3.5 text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar buscas ou palavras-chave…"
            aria-label="Pesquisar buscas agendadas"
            className="w-full rounded-full border border-border bg-surface/60 pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-brand/60"
          />
        </div>
      </div>

      {/* Jobs Grid */}
      {filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <CalendarClock className="mx-auto size-8 text-faint" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">Nenhuma busca agendada encontrada</h2>
          <p className="mt-1 text-xs text-muted">Crie uma busca para encontrar automaticamente vagas compatíveis.</p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-medium text-brand-foreground shadow"
          >
            <CalendarPlus className="size-3.5" /> Nova busca agendada
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onToggleStatus={handleToggleStatus}
              onEdit={(j) => setEditingJob(j)}
              onDelete={handleDelete}
              onRunFinished={loadData}
            />
          ))}
        </div>
      )}

      {/* Create Modal, Edit Modal & History Drawer */}
      <CreateJobModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadData}
      />

      <EditJobModal
        job={editingJob}
        isOpen={!!editingJob}
        onClose={() => setEditingJob(null)}
        onUpdated={loadData}
      />

      <RunHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        runs={store.runs}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="co-rise flex items-center justify-between rounded-xl border border-border bg-surface/40 p-4 shadow-sm transition-all hover:border-brand/30 hover:shadow-md">
      <div>
        <span className="text-xs font-medium text-muted">{label}</span>
        <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</div>
        <div className="mt-0.5 text-[11px] text-faint">{subtitle}</div>
      </div>
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text">
        {icon}
      </div>
    </div>
  );
}
