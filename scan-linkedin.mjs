#!/usr/bin/env node
/**
 * scan-linkedin.mjs — Busca vagas abertas no LinkedIn (foco em Estágio / Trainee)
 * Utiliza o endpoint público do LinkedIn (Guest API) sem necessidade de credenciais ou login.
 * Adiciona as vagas encontradas diretamente na pipeline de oportunidades do career-ops.
 *
 * Uso:
 *   node scan-linkedin.mjs
 *   node scan-linkedin.mjs --query "estagio software" --location "Brasil"
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

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--query" && args[i + 1]) query = args[++i];
  if (args[i] === "--location" && args[i + 1]) location = args[++i];
}

console.log(`\n🔍 Buscando vagas de estágio no LinkedIn...`);
console.log(`   Termo: "${query}" | Região: "${location}" | Nível: Estágio`);

const encodedQuery = encodeURIComponent(query);
const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodedQuery}&geoId=${geoId}&f_E=${f_E}&start=0`;

try {
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
  const cardRegex = /<li[\s\S]*?<\/li>/gi;
  const matches = html.match(cardRegex) || [];

  if (matches.length === 0) {
    console.log(`ℹ️ Nenhuma vaga nova encontrada no momento.`);
    process.exit(0);
  }

  console.log(`📋 Encontradas ${matches.length} vagas de estágio. Processando...\n`);

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

  for (const card of matches) {
    const titleMatch = card.match(/<h3 class="base-search-card__title">([\s\S]*?)<\/h3>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const companyMatch = card.match(/<h4 class="base-search-card__subtitle">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                         card.match(/<h4 class="base-search-card__subtitle">([\s\S]*?)<\/h4>/i);
    const company = companyMatch ? companyMatch[1].trim() : "Empresa";

    const locMatch = card.match(/<span class="job-search-card__location">([\s\S]*?)<\/span>/i);
    const loc = locMatch ? locMatch[1].trim() : location;

    const linkMatch = card.match(/<a class="base-card__full-link[^"]*" href="([^"?]+)/i);
    let jobUrl = linkMatch ? linkMatch[1].trim() : "";

    if (!jobUrl || !title) continue;

    if (existingUrls.has(jobUrl)) {
      console.log(`  ℹ️ Já cadastrada na pipeline: ${company} — ${title}`);
      continue;
    }

    validOffers.push({
      url: jobUrl,
      company,
      title,
      location: loc,
      provider: "linkedin",
      postedAt: today,
    });
    existingUrls.add(jobUrl);
    console.log(`  ✅ Vaga elegível: ${company} — ${title} (${loc})`);
  }

  if (validOffers.length > 0) {
    await appendToPipeline(validOffers);
    try {
      await appendToScanHistory(validOffers, today);
    } catch {}
    console.log(`\n🎉 Varredura concluída! ${validOffers.length} novas vagas de estágio enviadas para a sua pipeline.\n`);
  } else {
    console.log(`\nℹ️ Todas as vagas encontradas já estavam na sua pipeline.\n`);
  }
} catch (err) {
  console.error(`❌ Falha ao buscar vagas no LinkedIn: ${err.message}`);
}
