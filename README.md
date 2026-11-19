<h1 align="center">vagas</h1>

<p align="center"><strong>Um agente de IA open source para buscar emprego, em português e com modelos de IA locais.</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/idioma-pt--BR-009c3b?style=for-the-badge" alt="pt-BR">
  <img src="https://img.shields.io/badge/IA%20local-Ollama-000?style=for-the-badge" alt="Ollama">
  <img src="https://img.shields.io/badge/licen%C3%A7a-MIT-blue?style=for-the-badge" alt="MIT">
</p>

> [!IMPORTANT]
> **O _vagas_ é um fork independente e não oficial do [career-ops](https://github.com/career-ops-hq/career-ops)**, criado por [Santiago Fernández de Valderrama](https://santifer.io) ([@santifer](https://github.com/santifer)) e por mais de 700 contribuidores. Todo o crédito pelo projeto original é deles.
> Este fork **não é afiliado nem endossado** pelo career-ops ou por seu autor. "career-ops"™ é marca do autor original ([TRADEMARK.md](TRADEMARK.md)). O código segue sob a [Licença MIT](LICENSE), com o copyright original mantido. Veja [NOTICE.md](NOTICE.md).
> Encontrou um bug **neste fork**? Abra uma issue [aqui](https://github.com/igortude/vagas/issues), não no projeto original.

---

## O que é

O career-ops (e, por consequência, o vagas) é um sistema para organizar sua busca de emprego com IA:

- **Varre portais de vagas** (Greenhouse, Lever, Ashby, Workday, LinkedIn…) **sem gastar tokens**
- **Avalia cada vaga contra o seu currículo** e dá uma nota de compatibilidade
- **Gera currículos e cartas** adaptados para cada vaga, sem inventar experiência
- **Organiza o pipeline**: caixa de entrada, enviadas, entrevistas, propostas e follow-ups
- **Tem um painel web** para acompanhar tudo

## O que este fork adiciona

| | career-ops (original) | **vagas** (este fork) |
|---|---|---|
| Idioma da interface | Inglês | **Português (Brasil)** |
| Motor de IA | CLIs de IA (Claude Code, Codex, Gemini, OpenCode…) | Tudo isso **+ Ollama, com modelos locais** |
| Custo para avaliar vagas | Depende do plano da sua IA | **Pode ser zero**, rodando no seu computador |
| Privacidade | Local-first | Local-first, e com Ollama **nada sai da sua máquina** |

Principais arquivos adicionados: `ollama-cli.mjs`, `ollama-runner.mjs`, `web/src/app/api/ollama/` e `web/src/app/api/cv/ingest-local/`.

## Instalação

**Pré-requisitos:** [Node.js](https://nodejs.org) 22.13 ou mais recente, e [Git](https://git-scm.com).

```bash
git clone https://github.com/igortude/vagas.git
cd vagas
npm install

# painel web
cd web
npm install
npm run dev
```

Depois, abra o endereço que aparecer no terminal (por padrão, http://localhost:3000).

> Não use `npx @santifer/career-ops init` para instalar este fork. Esse comando instala o projeto **original**, em inglês e sem o suporte ao Ollama.

## Usando modelos locais (Ollama)

1. Instale o Ollama: https://ollama.com/download
2. Baixe um modelo, por exemplo:
   ```bash
   ollama pull qwen2.5:7b
   ```
3. No painel, vá em **Configuração → Motor de IA** e escolha **Ollama (Modelos Locais)**. O painel detecta automaticamente os modelos instalados.

Variáveis de ambiente opcionais:

| Variável | Para que serve | Padrão |
|---|---|---|
| `OLLAMA_MODEL` | Modelo usado nas avaliações | `qwen2.5-coder-abliterated:7b` |
| `OLLAMA_BASE_URL` | Endereço do servidor Ollama | `http://localhost:11434` |
| `OLLAMA_NUM_CTX` | Tamanho do contexto, em tokens | `32768` |
| `OLLAMA_TIMEOUT_MS` | Tempo máximo de espera por resposta | `300000` (5 min) |

Avaliação direto pelo terminal:

```bash
OLLAMA_MODEL=qwen2.5:7b node ollama-runner.mjs -p "Avalie esta vaga: https://..."
```

**Dica:** modelos de 7B rodam bem em máquinas com cerca de 16 GB de RAM. Modelos maiores avaliam melhor, mas são mais lentos.

## Uso básico

```bash
npm run scan     # procura vagas novas nos portais (zero tokens)
npm run doctor   # verifica se a instalação está correta

# vagas de estágio no LinkedIn, com filtro de modalidade
node scan-linkedin.mjs --modalidade remoto
node scan-linkedin.mjs --modalidade remoto,hibrido --query "estagio dados"
node scan-linkedin.mjs --presencial          # atalhos: --remoto, --hibrido, --presencial
```

Com `--modalidade`, cada vaga entra na pipeline com a modalidade junto da localização (ex.: `São Paulo, SP · Remoto`). Na tela **Pipeline**, digite `remoto`, `híbrido` ou `presencial` no campo **local…** para filtrar.

Na primeira vez, o painel guia você para adicionar currículo, cargos-alvo, pretensão salarial e localização. Seus dados pessoais (`cv.md`, `config/profile.yml`, `portals.yml`, `data/`) ficam no seu computador e estão no `.gitignore`.

Para a documentação completa (modos, portais, integrações com cada CLI, estrutura do projeto), veja o **[README completo em português](README.pt-BR.md)**, traduzido do original.

## Aviso

A IA pode errar: as avaliações são recomendações, não verdades absolutas. **Revise todo currículo e toda candidatura antes de enviar.** Use os portais de vagas respeitando os termos de uso deles. Veja o [LEGAL_DISCLAIMER.md](LEGAL_DISCLAIMER.md).

## Créditos

- **Projeto original:** [career-ops](https://github.com/career-ops-hq/career-ops), de [Santiago Fernández de Valderrama Aparicio](https://santifer.io) ([@santifer](https://github.com/santifer)) e [contribuidores](https://github.com/career-ops-hq/career-ops/graphs/contributors)
- **Tradução pt-BR e suporte a modelos locais:** [@igortude](https://github.com/igortude)
- README original, em inglês: [README.en.md](README.en.md)

## Licença

[MIT](LICENSE). Copyright © 2026 Santiago Fernández de Valderrama. As modificações deste fork são distribuídas sob a mesma licença.
