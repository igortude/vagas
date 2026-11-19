import Link from "next/link";
import { Suspense } from "react";
import { FollowupsView } from "@/components/followups/followups-view";
import { readFollowupsEnabled } from "@/lib/followups-server";

export const dynamic = "force-dynamic"; // cadence is computed fresh per request

export default function FollowupsPage() {
  if (!readFollowupsEnabled()) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl tracking-tight text-landing">Os acompanhamentos estão desativados</h1>
        <p className="mt-2 text-sm text-muted">
          Ative-os novamente em{" "}
          <Link href="/config" className="font-medium text-brand-text hover:underline">Configurações</Link>, ou defina{" "}
          <span className="font-mono">follow_ups.enabled: true</span> em <span className="font-mono">config/profile.yml</span>.
        </p>
      </div>
    );
  }
  return (
    <Suspense>
      <FollowupsView />
    </Suspense>
  );
}
