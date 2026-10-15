/* =========================================================
   Monitoramento Escolar — URE São José do Rio Preto
   Arquivo: app.js  |  Escopo: ESCOLAS REGULARES
   ---------------------------------------------------------
   Seções:
   1. Utilidades e formatação
   2. Armazenamento dos lançamentos
   3. Cálculos do IFA e da projeção
   4. Rankings (Top 5 e supervisores)
   5. Renderização das telas
   6. Calculadora semanal
   7. Ficha da escola
   8. Inicialização

   Convenção: presença e IFA ficam em PONTOS PERCENTUAIS (88,6 = 88,6%).
   Só `escola.presenca` (dados.js) é fração (0,886).
   ========================================================= */
"use strict";

const CHAVE_ARMAZENAMENTO = "lancamentosIFA-URE-SJRP";
const LIMITE_ATENCAO = 90; // média necessária a partir da qual a escola pede atenção

/* =========================
   1. Utilidades e formatação
   ========================= */

const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

const semValor = valor => valor === null || valor === undefined || valor === "";
const media = (lista, extrair) => lista.reduce((t, item) => t + extrair(item), 0) / lista.length;

function numero(valor, casas = 2) {
  if (semValor(valor)) return "Sem dado";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

// Recebe pontos percentuais (88,6) e devolve "88,60%".
const formatarPontos = (valor, casas = 2) =>
  semValor(valor) ? "Sem dado" : `${numero(valor, casas)}%`;

const nomeCompleto = escola => `${escola.nome} - ${escola.codigo}`;
const buscarEscola = codigo => ESCOLAS.find(e => e.codigo === String(codigo));

// Evita que textos da base sejam interpretados como HTML.
const escapar = texto => String(texto ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function preencherTabela(id, linhas, colunasVazio = 1) {
  const corpo = $(id);
  if (!corpo) return;
  corpo.innerHTML = linhas.length
    ? linhas.join("")
    : `<tr><td colspan="${colunasVazio}" class="sem-dado">Nenhum resultado disponível.</td></tr>`;
}

// Mensagem acessível (leitores de tela) com alternativa para alert().
function avisar(texto) {
  const area = $("#status-painel");
  if (area) area.textContent = texto;
  else alert(texto);
}

/* =========================
   2. Armazenamento dos lançamentos
   ========================= */

// Os dados publicados no GitHub são a base; o navegador só sobrescreve semanas lançadas.
function mesclarLancamentos(base, local) {
  const resultado = structuredClone(base);
  Object.entries(local || {}).forEach(([semana, escolas]) => {
    resultado[semana] = { ...(resultado[semana] || {}), ...escolas };
  });
  return resultado;
}

function carregarLancamentos() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO));
    return mesclarLancamentos(LANCAMENTOS_SEMANAIS, salvo);
  } catch (erro) {
    console.warn("Não foi possível ler os lançamentos salvos.", erro);
    return structuredClone(LANCAMENTOS_SEMANAIS);
  }
}

const salvarLancamentos = () =>
  localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(lancamentos));

let lancamentos = carregarLancamentos();

/* =========================
   3. Cálculos do IFA e da projeção
   ========================= */

// Soma e média de presença: base consolidada + semanas já lançadas.
function presencaAtual(escola) {
  let soma = escola.presenca * 100 * CONFIG.semanasConcluidas;
  let semanas = CONFIG.semanasConcluidas;

  for (let s = CONFIG.semanasConcluidas + 1; s <= CONFIG.semanaFinal; s++) {
    const valor = lancamentos?.[s]?.[escola.codigo];
    if (!semValor(valor)) {
      soma += Number(valor);
      semanas++;
    }
  }
  return { soma, semanas, media: soma / semanas };
}

// Média que a escola precisa manter nas semanas que faltam para fechar o IFA.
function mediaNecessaria(escola) {
  const { soma, semanas } = presencaAtual(escola);
  const restantes = CONFIG.semanaFinal - semanas;
  return restantes > 0 ? (CONFIG.semanaFinal * escola.ifa - soma) / restantes : null;
}

function situacaoIFA(escola) {
  const necessaria = mediaNecessaria(escola);
  if (presencaAtual(escola).media >= escola.ifa || necessaria === null) return "Dentro do IFA";
  return necessaria > 100 ? "Fora do alcance da meta" : "Em acompanhamento";
}

const SELOS = {
  "Dentro do IFA": "selo selo-dentro",
  "Em acompanhamento": "selo selo-acompanhamento",
  "Fora do alcance da meta": "selo selo-fora"
};
const seloSituacao = situacao => `<span class="${SELOS[situacao]}">${situacao}</span>`;

// Projeção de fechamento: semanas sem lançamento repetem a média atual da escola.
function presencaProjetada(escola) {
  const { soma, semanas, media: atual } = presencaAtual(escola);
  return (soma + (CONFIG.semanaFinal - semanas) * atual) / CONFIG.semanaFinal;
}

// Estado de cada semana futura: lançada, parcial ou prevista (atualiza sozinho).
function projecaoSemanal() {
  const semanas = [];
  for (let s = CONFIG.semanasConcluidas + 1; s <= CONFIG.semanaFinal; s++) {
    const valores = ESCOLAS
      .map(e => lancamentos?.[s]?.[e.codigo])
      .filter(v => !semValor(v))
      .map(Number);

    const estado = valores.length === 0 ? "prevista"
      : valores.length === ESCOLAS.length ? "lancada" : "parcial";

    semanas.push({
      semana: s,
      estado,
      lancadas: valores.length,
      mediaURE: valores.length ? media(valores, v => v) : null
    });
  }
  return semanas;
}

/* =========================
   4. Rankings
   ========================= */

const rankingTop5 = () => [...ESCOLAS].sort((a, b) => a.posicao - b.posicao).slice(0, 5);

// Critério: média da nota final das escolas; desempate pela presença média.
function rankingSupervisores() {
  const grupos = new Map();
  ESCOLAS.filter(e => e.supervisor).forEach(e => {
    if (!grupos.has(e.supervisor)) grupos.set(e.supervisor, []);
    grupos.get(e.supervisor).push(e);
  });

  return [...grupos]
    .map(([nome, escolas]) => ({
      nome,
      escolas,
      notaMedia: media(escolas, e => e.notaFinal),
      presencaMedia: media(escolas, e => presencaAtual(e).media),
      dentroIFA: escolas.filter(e => situacaoIFA(e) === "Dentro do IFA").length
    }))
    .sort((a, b) => b.notaMedia - a.notaMedia || b.presencaMedia - a.presencaMedia)
    .map((sup, i) => ({ ...sup, posicao: i + 1 }));
}

/* =========================
   5. Renderização das telas
   ========================= */

const botaoEscola = escola =>
  `<button type="button" class="escola-link" data-codigo="${escola.codigo}">${escapar(nomeCompleto(escola))}</button>`;

function renderizarTop5() {
  const lista = $("#top5-ranking");
  if (!lista) return;
  lista.innerHTML = rankingTop5().map(e => `
    <li class="top5-item ${e.posicao <= 3 ? `destaque-${e.posicao}` : ""}">
      <span class="top5-posicao" aria-label="${e.posicao}º lugar">${e.posicao}º</span>
      <div>${botaoEscola(e)}<p>Nota final ${numero(e.notaFinal)} · Presença ${formatarPontos(presencaAtual(e).media)}</p></div>
    </li>`).join("");
}

function renderizarSupervisores() {
  preencherTabela("#tabela-supervisores", rankingSupervisores().map(s => `
    <tr>
      <td>${s.posicao}º</td>
      <td>${escapar(s.nome)}</td>
      <td>${s.escolas.length}</td>
      <td>${numero(s.notaMedia)}</td>
      <td>${formatarPontos(s.presencaMedia)}</td>
      <td>${s.dentroIFA} de ${s.escolas.length}</td>
    </tr>`), 6);
}

function renderizarProjecao() {
  const linha = $("#linha-projecao");
  if (linha) {
    const rotulos = { lancada: "Lançada", parcial: "Parcial", prevista: "Prevista" };
    linha.innerHTML = projecaoSemanal().map(p => `
      <li class="semana semana-${p.estado}">
        <strong>Semana ${p.semana}</strong>
        <span>${rotulos[p.estado]}</span>
        <small>${p.mediaURE === null ? "Aguardando lançamento" : formatarPontos(p.mediaURE)}</small>
      </li>`).join("");
  }
  const kpi = $("#kpi-projecao");
  if (kpi) kpi.textContent = formatarPontos(media(ESCOLAS, presencaProjetada));
}

function renderizarVisaoGeral() {
  const maisNota = [...ESCOLAS].sort((a, b) => b.notaFinal - a.notaFinal)[0];
  const maisPresenca = [...ESCOLAS].sort((a, b) => presencaAtual(b).media - presencaAtual(a).media)[0];
  const dentro = ESCOLAS.filter(e => situacaoIFA(e) === "Dentro do IFA").length;

  const kpis = {
    "#kpi-escolas": ESCOLAS.length,
    "#kpi-ranking": ESCOLAS[0].nome,
    "#kpi-nota": maisNota.nome,
    "#kpi-presenca": maisPresenca.nome,
    "#kpi-ifa": `${dentro} de ${ESCOLAS.length}`
  };
  Object.entries(kpis).forEach(([id, texto]) => { if ($(id)) $(id).textContent = texto; });

  preencherTabela("#tabela-resumo", [...ESCOLAS].sort((a, b) => a.posicao - b.posicao).map(e => `
    <tr>
      <td>${e.posicao}º</td>
      <td>${botaoEscola(e)}</td>
      <td>${numero(e.notaFinal)}</td>
      <td>${formatarPontos(presencaAtual(e).media)}</td>
      <td>${formatarPontos(e.ifa)}</td>
      <td>${seloSituacao(situacaoIFA(e))}</td>
    </tr>`), 6);

  renderizarTop5();
  renderizarSupervisores();
  renderizarProjecao();
}

// Critérios de ordenação reutilizados pelas telas Escolas e IFA.
const ORDENACOES = {
  ranking: (a, b) => a.posicao - b.posicao,
  nota: (a, b) => b.notaFinal - a.notaFinal,
  presenca: (a, b) => presencaAtual(b).media - presencaAtual(a).media,
  ifa: (a, b) => b.ifa - a.ifa,
  nome: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
  necessaria: (a, b) => (mediaNecessaria(a) ?? Infinity) - (mediaNecessaria(b) ?? Infinity)
};

const correspondeBusca = (escola, busca) =>
  !busca || nomeCompleto(escola).toLowerCase().includes(busca);

function preencherSupervisores() {
  const select = $("#filtro-supervisor");
  [...new Set(ESCOLAS.map(e => e.supervisor).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach(nome => select.add(new Option(nome, nome)));
}

function renderizarEscolas() {
  const busca = $("#busca-escola").value.trim().toLowerCase();
  const supervisor = $("#filtro-supervisor").value;
  const lista = ESCOLAS
    .filter(e => correspondeBusca(e, busca) && (!supervisor || e.supervisor === supervisor))
    .sort(ORDENACOES[$("#ordenar-escolas").value] || ORDENACOES.ranking);

  $("#contador-escolas").textContent = `${lista.length} escola(s) exibida(s)`;
  preencherTabela("#tabela-escolas", lista.map(e => `
    <tr>
      <td>${e.posicao}º</td>
      <td>${botaoEscola(e)}</td>
      <td>${numero(e.notaFinal)}</td>
      <td>${formatarPontos(presencaAtual(e).media)}</td>
      <td>${formatarPontos(e.ifa)}</td>
      <td>${e.supervisor ? escapar(e.supervisor) : '<span class="sem-dado">Sem dado</span>'}</td>
      <td>${seloSituacao(situacaoIFA(e))}</td>
    </tr>`), 7);
}

function renderizarPlataformas() {
  const config = PLATAFORMAS[$("#selecionar-plataforma").value];
  const busca = $("#busca-plataforma").value.trim().toLowerCase();

  $("#titulo-plataforma-selecionada").textContent = config.nome;
  $("#descricao-plataforma").textContent =
    "Escolas ordenadas pelo indicador da plataforma selecionada. Escolas sem resultado não aparecem na lista.";

  const lista = ESCOLAS
    .filter(e => correspondeBusca(e, busca) && !semValor(e[config.campo]))
    .sort((a, b) => b[config.campo] - a[config.campo]);

  preencherTabela("#tabela-plataforma", lista.map((e, i) => `
    <tr>
      <td>${i + 1}º</td>
      <td>${escapar(nomeCompleto(e))}</td>
      <td>${numero(e[config.campo], config.casas)}</td>
    </tr>`), 3);
}

function renderizarIFA() {
  const busca = $("#busca-ifa").value.trim().toLowerCase();
  const situacao = $("#filtro-situacao-ifa").value;
  const lista = ESCOLAS
    .filter(e => correspondeBusca(e, busca) && (!situacao || situacaoIFA(e) === situacao))
    .sort(ORDENACOES[$("#ordenar-ifa").value] || ORDENACOES.nome);

  $("#contador-ifa").textContent = `${lista.length} escola(s) exibida(s)`;
  preencherTabela("#tabela-ifa", lista.map(e => {
    const necessaria = mediaNecessaria(e);
    const sit = situacaoIFA(e);
    const atencao = sit === "Em acompanhamento" && necessaria >= LIMITE_ATENCAO;
    return `
    <tr class="${atencao ? "destaque-atencao" : ""}">
      <td>${escapar(nomeCompleto(e))}</td>
      <td>${formatarPontos(presencaAtual(e).media)}</td>
      <td>${formatarPontos(e.ifa)}</td>
      <td>${formatarPontos(CONFIG.ifaURE)}</td>
      <td>${necessaria === null ? '<span class="sem-dado">Meta já atingida</span>' : formatarPontos(necessaria)}</td>
      <td>${seloSituacao(sit)}</td>
    </tr>`;
  }), 6);
}

function atualizarTudo() {
  renderizarVisaoGeral();
  renderizarEscolas();
  renderizarIFA();
}

/* =========================
   6. Calculadora semanal
   ========================= */

function renderizarCalculadora() {
  const semana = Number($("#semana-calculadora").value);
  lancamentos[semana] ??= {};

  $("#lancamento-grid").innerHTML = ESCOLAS.map(e => `
    <article class="lancamento">
      <h4>${escapar(nomeCompleto(e))}</h4>
      <label class="sr-only" for="input-${e.codigo}">
        Presença da semana ${semana} — ${escapar(nomeCompleto(e))}
      </label>
      <input type="number" id="input-${e.codigo}" min="0" max="100" step="0.01"
             inputmode="decimal" value="${lancamentos[semana][e.codigo] ?? ""}" placeholder="Presença %">
    </article>`).join("");
}

function calcularSemana() {
  const semana = Number($("#semana-calculadora").value);
  lancamentos[semana] ??= {};

  ESCOLAS.forEach(e => {
    const texto = $(`#input-${e.codigo}`).value.trim();
    const valor = Number(texto);
    // Ignora vazio e valores fora de 0–100 (evita distorcer o IFA).
    if (texto === "" || valor < 0 || valor > 100) delete lancamentos[semana][e.codigo];
    else lancamentos[semana][e.codigo] = valor;
  });

  salvarLancamentos();
  atualizarTudo();
  renderizarCalculadora();
  avisar(`Presenças da semana ${semana} calculadas e salvas neste navegador.`);
}

function exportarLancamentos() {
  const blob = new Blob([JSON.stringify(lancamentos, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "lancamentos-ifa-atualizados.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function restaurarBase() {
  if (!confirm("Deseja restaurar a base original e apagar os lançamentos salvos neste navegador?")) return;
  localStorage.removeItem(CHAVE_ARMAZENAMENTO);
  lancamentos = structuredClone(LANCAMENTOS_SEMANAIS);
  atualizarTudo();
  renderizarCalculadora();
}

/* =========================
   7. Ficha da escola
   ========================= */

const indicadorFicha = (rotulo, valor) =>
  `<article class="ficha-indicador"><span>${rotulo}</span><strong>${valor}</strong></article>`;

function abrirFicha(codigo) {
  const escola = buscarEscola(codigo);
  if (!escola) return;

  const necessaria = mediaNecessaria(escola);
  $("#modal-titulo").textContent = nomeCompleto(escola);
  $("#modal-conteudo").innerHTML = `
    <section class="ficha-indicadores">
      ${indicadorFicha("Ranking geral", `${escola.posicao}º lugar`)}
      ${indicadorFicha("Nota final", numero(escola.notaFinal))}
      ${indicadorFicha("Presença consolidada", formatarPontos(presencaAtual(escola).media))}
      ${indicadorFicha("Projeção de fechamento", formatarPontos(presencaProjetada(escola)))}
      ${indicadorFicha("IFA da escola", formatarPontos(escola.ifa))}
      ${indicadorFicha("IFA da URE", formatarPontos(CONFIG.ifaURE))}
      ${indicadorFicha("Média necessária", necessaria === null ? "Meta já atingida" : formatarPontos(necessaria))}
    </section>
    <p>${seloSituacao(situacaoIFA(escola))}</p>

    <h3>Desempenho por plataforma</h3>
    <div class="tabela-rolagem" tabindex="0" role="region" aria-label="Resultados por plataforma">
      <table>
        <caption class="sr-only">Resultados de ${escapar(nomeCompleto(escola))} por plataforma</caption>
        <thead><tr><th scope="col">Plataforma</th><th scope="col">Resultado</th></tr></thead>
        <tbody>
          ${Object.values(PLATAFORMAS).map(p => `
            <tr><td>${p.nome}</td><td>${numero(escola[p.campo], p.casas)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <h3>Supervisão</h3>
    <p>${escola.supervisor ? escapar(escola.supervisor) : '<span class="sem-dado">Supervisor(a) não informado(a) na base.</span>'}</p>

    <h3>Histórico no ranking geral</h3>
    <p>Top 3: ${escola.top3} vez(es) • Top 5: ${escola.top5} vez(es) • Top 10: ${escola.top10} vez(es)
       • Posição média: ${numero(escola.posicaoMedia, 1)}º lugar</p>`;

  $("#modal-escola").showModal();
}

/* =========================
   8. Inicialização
   ========================= */

function configurarEventos() {
  // Abertura da ficha por delegação: vale para qualquer tabela, mesmo após re-renderizar.
  document.addEventListener("click", evento => {
    const botao = evento.target.closest(".escola-link");
    if (botao) abrirFicha(botao.dataset.codigo);
  });

  // Navegação entre telas
  $$(".menu-botao").forEach(botao => botao.addEventListener("click", () => {
    $$(".menu-botao").forEach(b => {
      b.classList.remove("ativo");
      b.removeAttribute("aria-current");
    });
    botao.classList.add("ativo");
    botao.setAttribute("aria-current", "page");

    $$(".visao").forEach(secao => secao.classList.remove("ativa"));
    $(`#view-${botao.dataset.view}`).classList.add("ativa");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));

  // Filtros: cada campo chama a renderização da sua tela
  const ligar = (ids, evento, funcao) => ids.forEach(id => $(id).addEventListener(evento, funcao));
  ligar(["#busca-escola"], "input", renderizarEscolas);
  ligar(["#filtro-supervisor", "#ordenar-escolas"], "change", renderizarEscolas);
  ligar(["#busca-plataforma"], "input", renderizarPlataformas);
  ligar(["#selecionar-plataforma"], "change", renderizarPlataformas);
  ligar(["#busca-ifa"], "input", renderizarIFA);
  ligar(["#filtro-situacao-ifa", "#ordenar-ifa"], "change", renderizarIFA);

  $("#limpar-filtros").addEventListener("click", () => {
    $("#busca-escola").value = "";
    $("#filtro-supervisor").value = "";
    $("#ordenar-escolas").value = "ranking";
    renderizarEscolas();
  });
  $("#limpar-ifa").addEventListener("click", () => {
    $("#busca-ifa").value = "";
    $("#filtro-situacao-ifa").value = "";
    $("#ordenar-ifa").value = "presenca";
    renderizarIFA();
  });

  // Calculadora
  $("#semana-calculadora").addEventListener("change", renderizarCalculadora);
  $("#calcular-semana").addEventListener("click", calcularSemana);
  $("#exportar-lancamentos").addEventListener("click", exportarLancamentos);
  $("#restaurar-base").addEventListener("click", restaurarBase);

  // Modal
  $("#fechar-modal").addEventListener("click", () => $("#modal-escola").close());
  $("#modal-escola").addEventListener("click", evento => {
    if (evento.target.id === "modal-escola") $("#modal-escola").close();
  });
}

function iniciar() {
  configurarEventos();
  preencherSupervisores();
  atualizarTudo();
  renderizarPlataformas();
  renderizarCalculadora();
}

document.addEventListener("DOMContentLoaded", iniciar);
