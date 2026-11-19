// Shaping for the skill-gap panel.
//
// Pure .mjs so the CV page can import it and `node --test` can cover it.
//
// upskill.mjs does the weighting; nothing is recomputed here. What this module
// decides is when the map is trustworthy enough to show as advice, because two
// of its metadata fields describe conditions where the gaps are misleading
// rather than merely sparse — and both produce a map that LOOKS fine.

/**
 * @typedef {{skill: string, reports: number, lowFitReports: number,
 *            weightedScore: number, tier: string, sources: number[]}} Gap
 * @typedef {{kind: "no-known-skills"|"thin-coverage", text: string}} Caveat
 * @typedef {{label: string, skips: number, missing: number, partial: number,
 *            closeCalls: number, nudge: "learn"|"evidence", reports: number[]}} Blocker
 * @typedef {{available: boolean, reason: string|null, gaps: Gap[], caveats: Caveat[],
 *            blockers: Blocker[], skips: number,
 *            reportsWithMachineSummary: number, reportsRead: number}} SkillGapModel
 */

/**
 * Build the panel model.
 *
 * @param {{available?: boolean, reason?: string|null, data?: object|null}|null|undefined} payload
 * @param {number} [limit] - Most-weighted gaps to keep.
 * @returns {SkillGapModel}
 */
export function skillGapModel(payload, limit = 8) {
  if (!payload?.available || !payload.data) {
    return {
      available: false,
      reason: typeof payload?.reason === "string" ? payload.reason : "unavailable",
      gaps: [],
      caveats: [],
      blockers: [],
      skips: 0,
      reportsWithMachineSummary: 0,
      reportsRead: 0,
    };
  }

  const d = payload.data;
  const m = d.metadata ?? {};
  const gaps = (Array.isArray(d.gaps) ? d.gaps : [])
    .filter((g) => g && typeof g.skill === "string" && g.skill.trim() !== "")
    .slice(0, Math.max(1, Math.trunc(limit)));

  /** @type {Caveat[]} */
  const caveats = [];

  // upskill.mjs says a CV that yields no known skills floods the gap map,
  // because nothing can be subtracted as already-held. Say that only when a
  // gap list is actually shown. A missing count is not a counted zero: num()
  // turns an absent field into 0, and the no-tracker payload has no metadata.
  // An empty install then claimed the CV had no recognised skills beside
  // "No recurring gaps yet", which is the opposite of what happened.
  if (gaps.length > 0 && m.knownSkillCount === 0) {
    caveats.push({
      kind: "no-known-skills",
      text:
        "Nenhuma habilidade foi reconhecida no seu currículo, então nada pôde ser subtraído como já existente — " +
        "algumas destas provavelmente são habilidades que você já tem.",
    });
  }

  // When most reports carry no Machine Summary, the map is drawn from a minority
  // of the pipeline and says less about the search than its confident ordering
  // suggests.
  //
  // The gate is on GAPS, not on withMs. upskill.mjs reads a report's Gap TABLE
  // as well as its Machine Summary, so a pipeline with zero summaries can still
  // produce a full gap map — and the previous `withMs > 0` condition suppressed
  // the warning in exactly that case, the one where coverage is thinnest.
  // Verified against the core: parseReportGaps() on a report with only a Gap
  // table returns hasMachineSummary false and the gap text all the same.
  const withMs = num(m.reportsWithMachineSummary);
  const read = num(m.reportsRead);
  if (gaps.length > 0 && read > 0 && withMs * 2 < read) {
    caveats.push({
      kind: "thin-coverage",
      text:
        withMs === 0
          ? `Nenhum dos ${read} relatórios tem Machine Summary — estes vêm apenas das tabelas de lacunas.`
          : `Baseado em ${withMs} de ${read} relatórios — os demais não têm Machine Summary para ler lacunas.`,
    });
  }

  const sb = d.skipBlockers ?? {};
  const blockers = (Array.isArray(sb.blockers) ? sb.blockers : [])
    .filter((b) => b && typeof b.label === "string" && b.label.trim() !== "" && num(b.skips) > 0);

  return {
    available: true,
    reason: null,
    gaps,
    caveats,
    blockers,
    skips: num(sb.skips),
    reportsWithMachineSummary: withMs,
    reportsRead: read,
  };
}

/**
 * Bar width for a gap, relative to the heaviest one shown.
 *
 * Relative and not absolute: `weightedScore` has no ceiling, so a fixed scale
 * would render every gap as a stub on one pipeline and a full bar on another.
 *
 * @param {Gap} gap
 * @param {Gap[]} all
 * @returns {number} 0-100
 */
export function barPct(gap, all) {
  const top = Math.max(...all.map((g) => (Number.isFinite(g.weightedScore) ? g.weightedScore : 0)), 0);
  if (top <= 0) return 0;
  const v = Number.isFinite(gap.weightedScore) ? gap.weightedScore : 0;
  return Math.max(2, Math.round((v / top) * 100));
}

const NUDGE = {
  learn: "Seu currículo não mostra isto. Aprenda, ou mire em vagas que não pedem isso.",
  evidence: "Seu currículo mostra parte disto. Se você fez mais, adicione um bullet com o escopo e o resultado.",
};

/**
 * The two lines under a skip blocker: how the evaluator judged it, and what to do.
 *
 * @param {Blocker} b
 * @returns {{verdict: string, nudge: string}}
 */
export function blockerText(b) {
  const parts = [];
  if (b.missing === b.skips) parts.push(`ausente em todas as ${b.skips}`);
  else if (b.partial === b.skips) parts.push(`parcial em todas as ${b.skips}`);
  else parts.push(`ausente em ${b.missing}, parcial em ${b.partial}`);
  if (b.closeCalls > 0) parts.push(`${b.closeCalls} tiraram 3.5 ou mais`);
  return { verdict: parts.join(" · "), nudge: NUDGE[b.nudge] ?? NUDGE.learn };
}

function num(v) {
  return Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0;
}
