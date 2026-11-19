import type { Urgency } from "@/lib/followups";

// Display only; dates, channels and urgency values sent to the core stay canonical.
export function formatFollowupDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
    : date;
}

export function relativeFollowupDays(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days > 1) return `em ${days} dias`;
  return days === -1 ? "há 1 dia" : `há ${-days} dias`;
}

export const URGENCY_LABELS: Record<Urgency | "ALL", string> = {
  ALL: "Todas",
  overdue: "Atrasadas",
  urgent: "Urgentes",
  waiting: "Aguardando",
  cold: "Sem retorno",
};

export function channelLabelPtBr(channel: string): string {
  return ({ Email: "E-mail", Phone: "Telefone", Other: "Outro", LinkedIn: "LinkedIn" } as Record<string, string>)[channel] ?? channel;
}
