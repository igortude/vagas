"use client";

export default function ApplyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <p className="text-sm text-red-600">Não foi possível carregar o checklist desta candidatura.</p>
      <p className="mt-2 text-sm text-zinc-600">{error.message || "Não foi possível ler o relatório ou os arquivos relacionados."}</p>
      <button
        type="button"
        className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        onClick={() => reset()}
      >
        Tentar novamente
      </button>
    </div>
  );
}
