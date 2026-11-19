import { Send } from "lucide-react";
import { ApplyView } from "@/components/apply-view";
import { ApplyBackdropMount } from "@/components/apply/apply-backdrop-mount";

export const dynamic = "force-dynamic";

export default function ApplyPage() {
  return (
    <div className="relative min-h-screen">
      {/* full-viewport blurred form wallpaper (behind everything) */}
      <ApplyBackdropMount />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3">
          <Send className="size-6 text-brand-text" />
          <h1 className="font-display text-2xl tracking-tight text-landing">Candidatar-se</h1>
        </div>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          O career-ops lê o formulário original no seu computador e mostra os campos aqui de forma clara, com respostas sugeridas a partir do seu CV. Você confere cada resposta; depois, o career-ops preenche o formulário original para que você revise e envie por conta própria. Ele nunca envia a candidatura por você.
        </p>
        <div className="mt-6">
          <ApplyView />
        </div>
      </div>
    </div>
  );
}
