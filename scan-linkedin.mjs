#!/usr/bin/env node
/**
 * scan-linkedin.mjs — Busca vagas abertas no LinkedIn (foco em Estágio / Trainee)
 * Utiliza o endpoint público do LinkedIn (Guest API) sem necessidade de credenciais ou login.
 * Adiciona as vagas encontradas diretamente na pipeline de oportunidades do career-ops.
 *
 * Uso:
 *   node scan-linkedin.mjs
 *   node scan-linkedin.mjs --query "estagio software" --location "Brasil"
 *   node scan-linkedin.mjs --modalidade remoto              # somente vagas remotas
 *   node scan-linkedin.mjs --modalidade remoto,hibrido      # remotas e híbridas
 *   node scan-linkedin.mjs --presencial                     # atalhos: --remoto, --hibrido, --presencial
 *
 * Com --modalidade, a localização gravada na pipeline recebe o sufixo "· Remoto", "· Híbrido" ou
 * "· Presencial", e o filtro "local..." da tela Pipeline passa a filtrar por modalidade.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appendToPipeline, appendToScanHistory, PIPELINE_PATH } from "./scan.mjs";
import { getCareerOpsRoot } from "./path-resolver.mjs";
import { localToday } from "./lib/local-today.mjs";

const DATA_ROOT = getCareerOpsRoot();

// Parâmetros de busca padrão focados em estágio no Brasil
const args = process.argv.slice(2);
let query = "estagio desenvolvimento software";
let location = "Brasil";
let geoId = "106057199"; // Brasil no LinkedIn
let f_E = "1"; // Nível de experiência: 1 = Estágio (Internship)

// Modalidade de trabalho (filtro f_WT do LinkedIn): 1 = presencial, 2 = remoto, 3 = híbrido
const MODALIDADES = {
  presencial: { f_WT: "1", label: "Presencial" },
  remoto: { f_WT: "2", label: "Remoto" },
  hibrido: { f_WT: "3", label: "Híbrido" },
};
const normalize = (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
let modalidades = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--query" && args[i + 1]) query = args[++i];
  else if (args[i] === "--location" && args[i + 1]) location = args[++i];
  else if ((args[i] === "--modalidade" || args[i] === "--work-type") && args[i + 1]) {
    modalidades.push(...args[++i].split(",").map(normalize).filter(Boolean));
  } else if (args[i] === "--remote" || args[i] === "--remoto") modalidades.push("remoto");
  else if (args[i] === "--hibrido") modalidades.push("hibrido");
  else if (args[i] === "--presencial") modalidades.push("presencial");
}
modalidades = [...new Set(modalidades)];
const invalid = modalidades.filter((m) => !MODALIDADES[m]);
if (invalid.length) {
  console.error(`❌ Modalidade inválida: ${invalid.join(", ")}. Use: remoto, hibrido, presencial.`);
  process.exit(1);
}

// Título que contradiz a modalidade pedida (ex.: "Presencial" numa busca remota) — o LinkedIn erra às vezes.
const TITLE_HINTS = {
  presencial: /\bpresencial\b|on-?site/i,
  remoto: /\bremot[oa]\b|\bremote\b|home ?office|100% remoto/i,
  hibrido: /\bh[ií]brid[oa]\b|\bhybrid\b/i,
};
function contradicts(title, modalidade) {
  return Object.entries(TITLE_HINTS).some(([m, re]) => m !== modalidade && re.test(title) && !TITLE_HINTS[modalidade].test(title));
}

const passes = modalidades.length ? modalidades : [null];
console.log(`\n🔍 Buscando vagas de estágio no LinkedIn...`);
console.log(`   Termo: "${query}" | Região: "${location}" | Nível: Estágio | Modalidade: ${modalidades.length ? modalidades.map((m) => MODALIDADES[m].label).join(", ") : "todas"}`);

const decode = (t) => t.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

try {
  const today = localToday();
  const validOffers = [];

  // Ler pipeline atual para evitar duplicatas simples
  let existingUrls = new Set();
  if (existsSync(PIPELINE_PATH)) {
    const text = readFileSync(PIPELINE_PATH, "utf8");
    for (const match of text.matchAll(/https?:\/\/[^\s|]+/g)) {
      existingUrls.add(match[0]);
    }
  }

  for (const modalidade of passes) {
    const wt = modalidade ? `&f_WT=${MODALIDADES[modalidade].f_WT}` : "";
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(query)}&geoId=${geoId}&f_E=${f_E}${wt}&start=0`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!res.ok) {
      console.error(`❌ Erro na requisição do LinkedIn: Status ${res.status}`);
      process.exit(1);
    }

    const html = await res.text();
    const matches = html.match(/<li[\s\S]*?<\/li>/gi) || [];
    const label = modalidade ? MODALIDADES[modalidade].label : null;
    console.log(`\n📋 ${label ?? "Todas as modalidades"}: ${matches.length} vagas encontradas. Processando...\n`);

    for (const card of matches) {
      const titleMatch = card.match(/<h3 class="base-search-card__title">([\s\S]*?)<\/h3>/i);
      const title = titleMatch ? decode(titleMatch[1]) : "";

      const companyMatch = card.match(/<h4 class="base-search-card__subtitle">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                           card.match(/<h4 class="base-search-card__subtitle">([\s\S]*?)<\/h4>/i);
      const company = companyMatch ? decode(companyMatch[1]) : "Empresa";

      const locMatch = card.match(/<span class="job-search-card__location">([\s\S]*?)<\/span>/i);
      const loc = locMatch ? decode(locMatch[1]) : location;

      const linkMatch = card.match(/<a class="base-card__full-link[^"]*" href="([^"?]+)/i);
      const jobUrl = linkMatch ? linkMatch[1].trim() : "";

      if (!jobUrl || !title) continue;

      if (modalidade && contradicts(title, modalidade)) {
        console.log(`  ⏭️ Ignorada (título indica outra modalidade): ${company} — ${title}`);
        continue;
      }

      if (existingUrls.has(jobUrl)) {
        console.log(`  ℹ️ Já cadastrada na pipeline: ${company} — ${title}`);
        continue;
      }

      // A modalidade vai junto da localização: o filtro "local..." do Pipeline passa a aceitar "Remoto", "Híbrido" ou "Presencial".
      const locationWithMode = label ? `${loc} · ${label}` : loc;
      validOffers.push({
        url: jobUrl,
        company,
        title,
        location: locationWithMode,
        provider: "linkedin",
        postedAt: today,
      });
      existingUrls.add(jobUrl);
      console.log(`  ✅ Vaga elegível: ${company} — ${title} (${locationWithMode})`);
    }
  }

  if (validOffers.length > 0) {
    await appendToPipeline(validOffers);
    try {
      await appendToScanHistory(validOffers, today);
    } catch {}
    console.log(`\n🎉 Varredura concluída! ${validOffers.length} novas vagas de estágio enviadas para a sua pipeline.\n`);
  } else {
    console.log(`\nℹ️ Nenhuma vaga nova: as encontradas já estavam na sua pipeline.\n`);
  }
} catch (err) {
  console.error(`❌ Falha ao buscar vagas no LinkedIn: ${err.message}`);
}
