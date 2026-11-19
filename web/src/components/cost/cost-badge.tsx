import { Leaf, Coins, Sparkles } from "lucide-react";
import type { CostClass } from "@/lib/explore-cost";

// One primitive, four variants — the app's cost color-semantics (career-ops-ux
// lock, for DESIGN_SYSTEM.md): GREEN = free/positive (celebrate); NEUTRAL/muted
// (+ coin icon) = spend ("Uses tokens") — it INFORMS, it must not alarm nor
// celebrate, and crucially it must NOT be brand-orange: orange is reserved for
// the primary action (e.g. "Run your first FREE scan"), so an orange spend badge
// would collide ("go/free" vs "costs") and shout louder than the action itself.
// Muted spend AA-verified in both themes. Styles live in globals.css (.co-cost).

const LOCALIZED_COST: Record<CostClass, { label: string; tip: string }> = {
    "free-network": { label: "Grátis", tip: "Consulta vagas públicas por HTTP, sem IA nem tokens. Nada é salvo até você escolher adicionar uma vaga." },
    free: { label: "Grátis", tip: "Sem tokens. Apenas lê ou grava arquivos locais." },
    spend: { label: "Usa tokens", tip: "Avalia a vaga com a sua própria IA. Só consome tokens quando você escolhe uma vaga." },
    "free-gemini": { label: "Grátis · Gemini", tip: "Avalie com o plano gratuito do Gemini, sem custo de tokens." },
};

export function CostBadge({ kind, size = "sm", className = "" }: { kind: CostClass; size?: "xs" | "sm"; className?: string }) {
  const tone = kind === "spend" ? "spend" : "free";
  const Icon = kind === "spend" ? Coins : kind === "free-gemini" ? Sparkles : Leaf;
  return (
    <span className={`co-cost ${className}`} data-tone={tone} data-size={size} title={LOCALIZED_COST[kind].tip}>
      <Icon aria-hidden />
      {LOCALIZED_COST[kind].label}
    </span>
  );
}
