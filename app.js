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
   7. Fichas
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

// O atributo data-contexto define qual ficha abre: ranking, plataforma, ifa ou escolas.
const botaoEscola = (escola, contexto = "escolas") =>
  `<button type="button" class="escola-link" data-codigo="${escola.codigo}" data-contexto="${contexto}">${escapar(nomeCompleto(escola))}</button>`;

const botaoSupervisor = nome => nome
  ? `<button type="button" class="supervisor-link" data-supervisor="${escapar(nome)}">${escapar(nome)}</button>`
  : '<span class="sem-dado">Sem dado</span>';

function renderizarTop5() {
  const area = $("#top5-ranking");
  if (!area) return;
  const top = rankingTop5();

  // Pódio: 1º, 2º e 3º (o CSS posiciona o 1º no centro; a ordem de leitura continua 1º, 2º, 3º)
  const podio = top.slice(0, 3).map((e, i) => `
    <li class="podio-item podio-${i + 1}">
      <span class="sr-only">${i + 1}º lugar</span>
      <button type="button" class="escola-link" data-codigo="${e.codigo}" data-contexto="ranking">${escapar(e.nome)}</button>
      <small>Código ${e.codigo}</small>
      <dl class="podio-dados">
        <div><dt>Nota final</dt><dd>${numero(e.notaFinal)}</dd></div>
        <div><dt>Presença</dt><dd>${formatarPontos(presencaAtual(e).media, 1)}</dd></div>
      </dl>
      <span class="podio-degrau" aria-hidden="true">${i + 1}º</span>
    </li>`).join("");

  // 4º e 5º lugares em linhas
  const demais = top.slice(3).map((e, i) => `
    <li class="top-linha">
      <span class="top-num">${i + 4}º</span>
      <div>${botaoEscola(e, "ranking")}</div>
      <span class="top-nota">Nota ${numero(e.notaFinal)}</span>
    </li>`).join("");

  area.innerHTML = `<ol class="podio">${podio}</ol><ol class="top-lista" start="4">${demais}</ol>`;
}

function renderizarSupervisores() {
  preencherTabela("#tabela-supervisores", rankingSupervisores().map(s => `
    <tr>
      <td>${s.posicao}º</td>
      <td>${botaoSupervisor(s.nome)}</td>
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
    "#kpi-ifa": `${dentro} de ${ESCOLAS.length}`
  };
  Object.entries(kpis).forEach(([id, texto]) => { if ($(id)) $(id).textContent = texto; });

  // Destaques que são escolas: botões clicáveis
  [["#kpi-ranking", ESCOLAS[0], "ranking"], ["#kpi-nota", maisNota, "ranking"], ["#kpi-presenca", maisPresenca, "ifa"]]
    .forEach(([id, escola, contexto]) => { if ($(id)) $(id).innerHTML = botaoEscola(escola, contexto); });

  preencherTabela("#tabela-resumo", [...ESCOLAS].sort((a, b) => a.posicao - b.posicao).map(e => `
    <tr>
      <td>${e.posicao}º</td>
      <td>${botaoEscola(e, "ranking")}</td>
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
      <td>${botaoSupervisor(e.supervisor)}</td>
      <td>${seloSituacao(situacaoIFA(e))}</td>
    </tr>`), 7);
}

// Plataforma exibida no momento (as abas alteram este valor)
let plataformaAtual = "tarefa";

function montarAbasPlataforma() {
  const area = $("#abas-plataforma");
  area.innerHTML = Object.entries(PLATAFORMAS).map(([chave, p]) => `
    <button type="button" class="aba-plataforma" data-chave="${chave}"
            aria-pressed="${chave === plataformaAtual}">${p.nome}</button>`).join("");

  area.addEventListener("click", evento => {
    const botao = evento.target.closest(".aba-plataforma");
    if (!botao) return;
    plataformaAtual = botao.dataset.chave;
    $$(".aba-plataforma", area).forEach(b => b.setAttribute("aria-pressed", b === botao));
    renderizarPlataformas();
  });
}

// Ranking da plataforma em barras proporcionais ao melhor resultado
function renderizarPlataformas() {
  const config = PLATAFORMAS[plataformaAtual];
  const busca = $("#busca-plataforma").value.trim().toLowerCase();
  const campo = config.campo;

  const ordenadas = ESCOLAS.filter(e => !semValor(e[campo])).sort((a, b) => b[campo] - a[campo]);
  const maximo = ordenadas.length ? ordenadas[0][campo] : 0;
  const semResultado = ESCOLAS.filter(e => semValor(e[campo]));

  $("#titulo-plataforma-selecionada").textContent = config.nome;
  $("#descricao-plataforma").textContent = "Barras proporcionais ao melhor resultado. Selecione a escola para ver a ficha.";
  $("#resumo-plataforma").textContent = ordenadas.length
    ? `${ordenadas.length} de ${ESCOLAS.length} escolas com resultado · Média da URE: ${numero(media(ordenadas, e => e[campo]), config.casas)} · Melhor resultado: ${numero(maximo, config.casas)}`
    : "Nenhuma escola com resultado nesta plataforma.";

  $("#barras-plataforma").innerHTML = ordenadas
    .map((e, i) => ({ e, n: i + 1 }))
    .filter(({ e }) => correspondeBusca(e, busca))
    .map(({ e, n }) => `
      <li class="barra ${n <= 3 ? `barra-${n}` : ""}">
        <span class="barra-pos">${n}º</span>
        <div class="barra-corpo">
          ${botaoEscola(e, "plataforma")}
          <div class="barra-trilho" aria-hidden="true">
            <span class="barra-fill" style="width:${maximo > 0 ? (e[campo] / maximo * 100).toFixed(1) : 0}%"></span>
          </div>
        </div>
        <strong class="barra-valor">${numero(e[campo], config.casas)}</strong>
      </li>`).join("");

  $("#sem-dado-plataforma").innerHTML = semResultado.length
    ? `Sem resultado nesta plataforma: ${semResultado.map(e => botaoEscola(e, "plataforma")).join("; ")}.`
    : "";
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
      <td>${botaoEscola(e, "ifa")}</td>
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
   7. Fichas (modal): o conteúdo muda conforme o local do clique
   ========================= */

// Monta uma tabela acessível; as células aceitam HTML.
const tabela = (legenda, cabecalhos, linhas) => `
  <div class="tabela-rolagem" tabindex="0" role="region" aria-label="${escapar(legenda)}">
    <table>
      <caption class="sr-only">${escapar(legenda)}</caption>
      <thead><tr>${cabecalhos.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  </div>`;

// Posição, média e melhor resultado de uma escola em uma plataforma
function estatisticaPlataforma(chave, escola) {
  const campo = PLATAFORMAS[chave].campo;
  const validas = ESCOLAS.filter(e => !semValor(e[campo])).sort((a, b) => b[campo] - a[campo]);
  const indice = validas.indexOf(escola);
  return {
    posicao: indice >= 0 ? indice + 1 : null,
    total: validas.length,
    media: validas.length ? media(validas, e => e[campo]) : null,
    melhor: validas.length ? validas[0][campo] : null
  };
}

const textoPosicao = est => est.posicao ? `${est.posicao}º de ${est.total}` : "Sem dado";

function tabelaPlataformas(escola) {
  return tabela(`Resultados de ${escola.nome} por plataforma`,
    ["Plataforma", "Resultado", "Posição", "Média da URE"],
    Object.entries(PLATAFORMAS).map(([chave, p]) => {
      const est = estatisticaPlataforma(chave, escola);
      return [p.nome, numero(escola[p.campo], p.casas), textoPosicao(est), numero(est.media, p.casas)];
    }));
}

// Cada contexto devolve o rótulo da visão e o HTML das tabelas
const FICHAS = {
  // Clique no Top 5, no resumo ou nos destaques de ranking
  ranking: e => ({
    rotulo: "Visão: ranking geral",
    html: tabela(`Posição de ${e.nome} no ranking geral`, ["Indicador", "Resultado"], [
      ["Posição no ranking geral", `${e.posicao}º de ${ESCOLAS.length}`],
      ["Nota final", numero(e.notaFinal)],
      ["Nota Tarefa SP", numero(e.notaTarefa)],
      ["Vezes no Top 3 / Top 5 / Top 10", `${e.top3} / ${e.top5} / ${e.top10}`],
      ["Posição média ao longo do ano", `${numero(e.posicaoMedia, 1)}º`]
    ]) + "<h3>Posição por plataforma</h3>" + tabelaPlataformas(e)
  }),

  // Clique nas barras de uma plataforma
  plataforma: e => {
    const p = PLATAFORMAS[plataformaAtual];
    const est = estatisticaPlataforma(plataformaAtual, e);
    const tem = !semValor(e[p.campo]) && est.media !== null;
    return {
      rotulo: `Visão: plataforma ${p.nome}`,
      html: tabela(`${e.nome} em ${p.nome}`, ["Indicador", "Resultado"], [
        ["Resultado", numero(e[p.campo], p.casas)],
        ["Posição", textoPosicao(est)],
        ["Média da URE", numero(est.media, p.casas)],
        ["Diferença para a média", tem ? numero(e[p.campo] - est.media, p.casas) : "Sem dado"],
        ["Melhor resultado da URE", numero(est.melhor, p.casas)]
      ]) + "<h3>Todas as plataformas</h3>" + tabelaPlataformas(e)
    };
  },

  // Clique na tela Aluno Presente / IFA
  ifa: e => {
    const necessaria = mediaNecessaria(e);
    const periodos = [["Semanas 1 a 37", formatarPontos(e.presenca * 100), "Base consolidada"]];
    for (let s = CONFIG.semanasConcluidas + 1; s <= CONFIG.semanaFinal; s++) {
      const v = lancamentos?.[s]?.[e.codigo];
      periodos.push([`Semana ${s}`, semValor(v) ? "Sem lançamento" : formatarPontos(v), semValor(v) ? "Prevista" : "Lançada"]);
    }
    return {
      rotulo: "Visão: Aluno Presente / IFA",
      html: tabela(`IFA de ${e.nome}`, ["Indicador", "Resultado"], [
        ["Presença consolidada", formatarPontos(presencaAtual(e).media)],
        ["IFA da escola", formatarPontos(e.ifa)],
        ["IFA da URE", formatarPontos(CONFIG.ifaURE)],
        ["Média necessária até a semana 42", necessaria === null ? "Meta já atingida" : formatarPontos(necessaria)],
        ["Projeção de fechamento", formatarPontos(presencaProjetada(e))],
        ["Situação", seloSituacao(situacaoIFA(e))]
      ]) + "<h3>Presença por período</h3>" + tabela(`Presença de ${e.nome} por período`, ["Período", "Presença", "Status"], periodos)
    };
  },

  // Clique na tela Escolas (ficha completa)
  escolas: e => ({
    rotulo: "Visão: ficha completa",
    html: tabela(`Resumo de ${e.nome}`, ["Indicador", "Resultado"], [
      ["Ranking geral", `${e.posicao}º de ${ESCOLAS.length}`],
      ["Nota final", numero(e.notaFinal)],
      ["Presença consolidada", formatarPontos(presencaAtual(e).media)],
      ["IFA da escola", formatarPontos(e.ifa)],
      ["Situação do IFA", seloSituacao(situacaoIFA(e))],
      ["Supervisor(a)", botaoSupervisor(e.supervisor)]
    ]) + "<h3>Desempenho por plataforma</h3>" + tabelaPlataformas(e)
  })
};

function mostrarModal() {
  const modal = $("#modal-escola");
  if (!modal.open) modal.showModal();
  $("#modal-conteudo").scrollTop = 0;
}

function abrirFicha(codigo, contexto = "escolas") {
  const escola = buscarEscola(codigo);
  if (!escola) return;
  const { rotulo, html } = (FICHAS[contexto] || FICHAS.escolas)(escola);

  $("#modal-titulo").textContent = nomeCompleto(escola);
  $("#modal-conteudo").innerHTML = `<p class="contexto-ficha">${escapar(rotulo)}</p>${html}`;
  mostrarModal();
}

// Clique no nome de um(a) supervisor(a): tabela com as escolas dele(a)
function abrirSupervisor(nome) {
  const sup = rankingSupervisores().find(s => s.nome === nome);
  if (!sup) return;

  $("#modal-titulo").textContent = sup.nome;
  $("#modal-conteudo").innerHTML = `
    <p class="contexto-ficha">Visão: supervisão (${sup.posicao}º no ranking de supervisores)</p>
    ${tabela(`Escolas de ${sup.nome}`, ["Escola", "Nota final", "Presença", "IFA", "Situação"],
      [...sup.escolas].sort(ORDENACOES.ranking).map(e => [
        botaoEscola(e, "escolas"), numero(e.notaFinal), formatarPontos(presencaAtual(e).media),
        formatarPontos(e.ifa), seloSituacao(situacaoIFA(e))
      ]))}
    <p>Nota média: <strong>${numero(sup.notaMedia)}</strong> · Presença média:
       <strong>${formatarPontos(sup.presencaMedia)}</strong> · Dentro do IFA:
       <strong>${sup.dentroIFA} de ${sup.escolas.length}</strong></p>`;
  mostrarModal();
}

/* =========================
   8. Inicialização
   ========================= */

function configurarEventos() {
  // Abertura da ficha por delegação: vale para qualquer tabela, mesmo após re-renderizar.
  document.addEventListener("click", evento => {
    const escola = evento.target.closest(".escola-link");
    if (escola) return abrirFicha(escola.dataset.codigo, escola.dataset.contexto);

    const supervisor = evento.target.closest(".supervisor-link");
    if (supervisor) abrirSupervisor(supervisor.dataset.supervisor);
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
  montarAbasPlataforma();
  atualizarTudo();
  renderizarPlataformas();
  renderizarCalculadora();
}

document.addEventListener("DOMContentLoaded", iniciar);
