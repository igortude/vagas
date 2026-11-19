/**
 * Copy for a pipeline list that has nothing to show.
 *
 * Plain module with no filesystem access: the pipeline view is a client
 * component, and the tracker parser (which reads the alias table) is not.
 *
 * A tracker with rows that the current tab or search hid keeps the filter
 * hint. A file with no rows does not tell the reader to clear a search.
 *
 * @param {{ shape: string, query?: string, min?: number | null, tab?: string }} state
 * @returns {{ kind: "filtered" | "empty" | "malformed", title: string, detail: string }}
 */
export function trackerEmptyMessage({ shape, query, min, tab }) {
  if (shape === "malformed") {
    return {
      kind: "malformed",
      title: "O arquivo do tracker não é uma tabela",
      detail: "data/applications.md não é uma tabela de tracker. O arquivo não foi alterado.",
    };
  }
  const filtering = Boolean(String(query ?? "").trim())
    || (min != null && min !== "")
    || (tab && tab !== "ALL" && tab !== "INBOX");
  if (shape === "rows" || filtering) {
    return {
      kind: "filtered",
      title: "Nenhum resultado",
      detail: "Tente outra aba ou limpe a busca.",
    };
  }
  return {
    kind: "empty",
    title: "Nenhuma candidatura ainda",
    detail: "Vagas avaliadas e adicionadas aparecerão aqui.",
  };
}
