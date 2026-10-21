/* =========================================================
   Monitoramento Escolar — URE São José do Rio Preto
   Arquivo: app.js  |  Escopo: ESCOLAS REGULARES
   ---------------------------------------------------------
   Seções:
   1. Utilidades e formatação
   2. Armazenamento dos lançamentos (Firebase: IFA e Plataformas)
   3. Cálculos do IFA e da projeção
   4. Rankings (Top 5 e supervisores)
   5. Renderização das telas
   6. Calculadoras semanais (IFA e Plataformas)
   7. Fichas
   8. Inicialização
   ========================================================= */
"use strict";

const CHAVE_ARMAZENAMENTO = "lancamentosIFA-URE-SJRP";
const LIMITE_ATENCAO = 90; 

if (typeof PLATAFORMAS !== "undefined" && !PLATAFORMAS.top3) {
  PLATAFORMAS.top3 = { 
    nome: "Top 3 (Pódios)", 
    campo: "top3", 
    casas: 0 
  };
}

/* =========================
   1. Utilidades e formatação
   ========================= */

const $ = (seletor, raiz = document) => raiz.querySelector(seletor); const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

const semValor = valor => valor === null || valor === undefined || valor === "";
const media = (lista, extrair) => lista.reduce((t, item) => t + extrair(item), 0) / lista.length;

function numero(valor, casas = 2) {
  if (semValor(valor)) return "Sem dado";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

const formatarPontos = (valor, casas = 2) =>
  semValor(valor) ? "Sem dado" : `${numero(valor, casas)}%`;

const formatarNota = valor => semValor(valor)
  ? "Sem dado"
  : (Math.round(Number(valor) * 100) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const formatarPlataforma = (config, valor) => semValor(valor) ? "Sem dado"
  : config.formato === "percentual" ? `${numero(valor * 100, 2)}%` : numero(valor, config.casas);

function textoValor(config, registro, apenasTexto = false) {
  if (!registro || semValor(registro[config.campo])) return "Sem dado";
  const principal = formatarPlataforma(config, registro[config.campo]);
  
  if (config.campoNota) {
    if (apenasTexto) {
        return `Nota ${formatarNota(registro[config.campoNota])} (${principal})`;
    }
    return `<div class="duas-colunas-tabela">
              <span><strong>Nota:</strong> ${formatarNota(registro[config.campoNota])}</span> 
              <span><strong>Percentual:</strong> ${principal}</span>
            </div>`;
  }
  return config.campo === 'top3' ? `${principal} vezes` : principal;
}

function mediaRegistro(config, lista) {
  if (!lista.length) return null;
  const registro = { [config.campo]: media(lista, e => e[config.campo]) };
  if (config.campoNota) registro[config.campoNota] = media(lista, e => e[config.campoNota]);
  return registro;
}

const nomeCompleto = escola => `${escola.nome} - ${escola.codigo}`;
const buscarEscola = codigo => ESCOLAS.find(e => e.codigo === String(codigo));

const escapar = texto => String(texto ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function preencherTabela(id, linhas, colunasVazio = 1) {
  const corpo = $(id);
  if (!corpo) return;
  corpo.innerHTML = linhas.length
    ? linhas.join("")
    : `<tr><td colspan="${colunasVazio}" class="sem-dado">Nenhum resultado disponível.</td></tr>`;
}

function avisar(texto, erro = false) {
  const area = $("#status-painel");
  if (area) area.textContent = texto;

  const antigo = document.getElementById("toast-aviso");
  if (antigo) antigo.remove();

  const toast = document.createElement("div");
  toast.id = "toast-aviso";
  toast.className = erro ? "toast-erro" : "toast-sucesso";
  toast.textContent = texto;

  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4000);
}

/* =========================
   2. Armazenamento dos lançamentos (Firebase)
   ========================= */

const firebaseConfig = {
  apiKey: "AIzaSyCG3259iTf9HRkIUbS5PGzSm5DOUXhlB0Y",
  authDomain: "monitoramento-ure-sjrp.firebaseapp.com",
  projectId: "monitoramento-ure-sjrp",
  storageBucket: "monitoramento-ure-sjrp.firebasestorage.app",
  messagingSenderId: "208479080069",
  appId: "1:208479080069:web:bc0d2efefaa6fd5e5663ec"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const docRefIFA = db.collection("monitoramento").doc("lancamentosIFA");
const docRefPlat = db.collection("monitoramento").doc("lancamentosPlataformas");

function mesclarLancamentos(base, local) {
  const resultado = structuredClone(base || {});
  Object.entries(local || {}).forEach(([semana, escolas]) => {
    resultado[semana] = { ...(resultado[semana] || {}), ...escolas };
  });
  return resultado;
}

function sincronizacaoAtiva() { return true; }

let lancamentos = typeof LANCAMENTOS_SEMANAIS !== "undefined" ? structuredClone(LANCAMENTOS_SEMANAIS) : {};
let lancamentosPlat = {};

function definirSincronizacao(texto, alerta = false) {
  const area = $("#status-sincronizacao");
  if (!area) return;
  area.textContent = texto;
  area.classList.toggle("status-alerta", alerta);
}

async function carregarRemoto() {
  if (!sincronizacaoAtiva()) return;
  try {
    const snapIFA = await docRefIFA.get();
    const snapPlat = await docRefPlat.get();
    
    if (snapIFA.exists) {
      lancamentos = mesclarLancamentos(typeof LANCAMENTOS_SEMANAIS !== "undefined" ? LANCAMENTOS_SEMANAIS : {}, snapIFA.data());
    }
    
    if (snapPlat.exists) {
      lancamentosPlat = snapPlat.data();
    } else {
      await docRefPlat.set({});
    }

    atualizarTudo();
    if (typeof renderizarCalculadora === 'function') renderizarCalculadora();
    if (typeof renderizarCalculadoraPlat === 'function') renderizarCalculadoraPlat();
    definirSincronizacao("Base Firebase conectada: os lançamentos ficam salvos para todos.");
  } catch (erro) {
    console.warn("Falha ao ler a base do Firebase.", erro);
    definirSincronizacao("Sem conexão com o Firebase. Exibindo apenas os dados locais publicados.", true);
  }
}

async function enviarRemoto(registros) {
  const dadosParaSalvar = {};
  registros.forEach(reg => {
    if (!dadosParaSalvar[reg.semana]) dadosParaSalvar[reg.semana] = {};
    dadosParaSalvar[reg.semana][reg.codigo] = reg.valor;
  });
  await docRefIFA.set(dadosParaSalvar, { merge: true });
  if (typeof aplicarRegistro === 'function') registros.forEach(aplicarRegistro);
}

/* =========================
   3. Cálculos do IFA e da projeção
   ========================= */

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

function presencaProjetada(escola) {
  const { soma, semanas, media: atual } = presencaAtual(escola);
  return (soma + (CONFIG.semanaFinal - semanas) * atual) / CONFIG.semanaFinal;
}

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

const botaoEscola = (escola, contexto = "escolas") =>
  `<button type="button" class="escola-link" data-codigo="${escola.codigo}" data-contexto="${contexto}">${escapar(nomeCompleto(escola))}</button>`;

const botaoSupervisor = nome => nome
  ? `<button type="button" class="supervisor-link" data-supervisor="${escapar(nome)}">${escapar(nome)}</button>`
  : '<span class="sem-dado">Sem dado</span>';

function renderizarTop5() {
  const area = $("#top5-ranking");
  if (!area) return;
  const top = rankingTop5();

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
  Object.entries(kpis).forEach(([id, texto]) => { if ($(id))$(id).textContent = texto; });

  [["#kpi-ranking", ESCOLAS[0], "ranking"], ["#kpi-nota", maisNota, "ranking"], ["#kpi-presenca", maisPresenca, "ifa"]]
    .forEach(([id, escola]) => { if ($(id))$(id).innerHTML = botaoEscola(escola, "ranking"); });

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
  if (!select) return;
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

let plataformaAtual = "tarefa";

function montarAbasPlataforma() {
  const area = $("#abas-plataforma");
  if (!area) return;
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

function renderizarPlataformas() {
  const config = PLATAFORMAS[plataformaAtual];
  const busca = $("#busca-plataforma").value.trim().toLowerCase();
  const campo = config.campoNota || config.campo;

  const ordenadas = ESCOLAS.filter(e => !semValor(e[campo])).sort((a, b) => b[campo] - a[campo]);
  const maximo = ordenadas.length ? ordenadas[0][campo] : 0;
  const semResultado = ESCOLAS.filter(e => semValor(e[campo]));

  $("#titulo-plataforma-selecionada").textContent = config.nome;
  $("#descricao-plataforma").textContent = config.campoNota
    ? "Ranqueado pela nota da plataforma. Barras proporcionais à maior nota. Selecione a escola para ver a ficha."
    : "Barras proporcionais ao melhor resultado. Selecione a escola para ver a ficha.";
  
  $("#resumo-plataforma").textContent = ordenadas.length
    ? `${ordenadas.length} de ${ESCOLAS.length} escolas com resultado · Média da URE: ${textoValor(config, mediaRegistro(config, ordenadas), true)} · Melhor resultado: ${textoValor(config, ordenadas[0], true)}`
    : "Nenhuma escola com resultado nesta plataforma.";

  $("#barras-plataforma").innerHTML = ordenadas
    .map((e, i) => ({ e, n: i + 1 }))
    .filter(({ e }) => correspondeBusca(e, busca))
    .map(({ e, n }) => {
      const renderValor = config.campoNota 
        ? `<div class="barra-valores-duplos">
             <div class="valor-col"><small>Nota</small><strong>${formatarNota(e[config.campoNota])}</strong></div>
             <div class="valor-col"><small>Percentual</small><strong>${formatarPlataforma(config, e[config.campo])}</strong></div>
           </div>`
        : `<strong class="barra-valor">${formatarPlataforma(config, e[campo])}${config.campo === 'top3' ? ' <small>vezes</small>' : ''}</strong>`;

      return `
      <li class="barra ${n <= 3 ? `barra-${n}` : ""}">
        <span class="barra-pos">${n}º</span>
        <div class="barra-corpo">
          ${botaoEscola(e, "plataforma")}
          <div class="barra-trilho" aria-hidden="true">
            <span class="barra-fill" style="width:${maximo > 0 ? (e[campo] / maximo * 100).toFixed(1) : 0}%"></span>
          </div>
        </div>
        ${renderValor}
      </li>`;
    }).join("");

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
  if (typeof renderizarGraficos === "function") renderizarGraficos(); 
}

/* =========================
   6. Calculadoras
   ========================= */

const TODAS = "__todas__";

function preencherResponsaveis() {
  const select = $("#responsavel-lancamento");
  if (!select) return;
  select.add(new Option("Todas as escolas da URE", TODAS));
  [...new Set(ESCOLAS.map(e => e.supervisor).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach(nome => select.add(new Option(nome, nome)));
}

function escolasDoResponsavel() {
  const quem = $("#responsavel-lancamento")?.value;
  if (!quem) return ESCOLAS;
  return quem === TODAS ? ESCOLAS : ESCOLAS.filter(e => e.supervisor === quem);
}

function renderizarCalculadora() {
  const grid = $("#lancamento-grid");
  if (!grid) return;
  const semana = Number($("#semana-calculadora").value);
  lancamentos[semana] ??= {};
  
  const busca = ($("#busca-calculadora").value || "").trim().toLowerCase();
  const lista = escolasDoResponsavel().filter(e => correspondeBusca(e, busca));

  grid.innerHTML = lista.length ? lista.map(e => `
    <article class="lancamento-linha">
      <h4>${escapar(e.nome)} <small class="codigo-escola">(${e.codigo})</small></h4>
      <label class="sr-only" for="input-${e.codigo}">Presença da semana ${semana} — ${escapar(e.nome)}</label>
      <input type="number" id="input-${e.codigo}" data-codigo="${e.codigo}" min="0" max="100" step="0.01"
             inputmode="decimal" value="${lancamentos[semana][e.codigo] ?? ""}" placeholder="0.00">
    </article>`).join("")
    : '<p class="sem-dado" style="padding: 20px; text-align: center;">Nenhuma escola encontrada.</p>';
}

function aplicarRegistro({ semana, codigo, valor }) {
  lancamentos[semana] ??= {};
  if (valor === null) delete lancamentos[semana][codigo];
  else lancamentos[semana][codigo] = valor;
}

async function calcularSemana() {
  const semana = Number($("#semana-calculadora").value); const registros = [];    for (const campo of $$("#lancamento-grid input")) {
    const texto = campo.value.trim();
    const valor = Number(texto);
    if (texto !== "" && (Number.isNaN(valor) || valor < 0 || valor > 100)) {
      avisar(`Valor inválido: use de 0 a 100.`, true);
      campo.focus();
      return;
    }
    const novo = texto === "" ? null : valor;
    if (novo !== (lancamentos[semana]?.[campo.dataset.codigo] ?? null)) {
      registros.push({ semana, codigo: campo.dataset.codigo, valor: novo });
    }
  }
  if (!registros.length) return avisar("Nenhuma alteração para salvar.");

  const botao = $("#calcular-semana");
  if (botao) botao.disabled = true;
  try {
    if (sincronizacaoAtiva()) {
      await enviarRemoto(registros);
    } else {
      registros.forEach(aplicarRegistro);
    }
    atualizarTudo();
    renderizarCalculadora();
    avisar(`Semana ${semana} salva com sucesso na nuvem!`);
  } catch (erro) {
    console.error(erro);
    avisar("Erro ao salvar no Firebase.", true);
  } finally {
    if (botao) botao.disabled = false;
  }
}

// Plataformas
function preencherFiltrosPlataformas() {
  const selResp = $("#responsavel-plat");
  const selPlat = $("#plat-selecionada");
  if (!selResp || !selPlat) return;

  selResp.add(new Option("Todas as Escolas (Visão Dirigente)", TODAS));
  [...new Set(ESCOLAS.map(e => e.supervisor).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach(nome => selResp.add(new Option(`Supervisor(a): ${nome}`, nome)));

  Object.entries(PLATAFORMAS).forEach(([chave, p]) => {
    if (chave !== 'top3') selPlat.add(new Option(p.nome, chave));
  });
}

function renderizarCalculadoraPlat() {
  const grid = $("#lancamento-grid-plat");
  const plat = $("#plat-selecionada")?.value;
  const semana = Number($("#semana-plat")?.value);
  const resp = $("#responsavel-plat")?.value || TODAS;
  const busca = ($("#busca-plat-calc")?.value || "").trim().toLowerCase();

  if (!grid || !plat) return;
  
  lancamentosPlat[plat] ??= {};
  lancamentosPlat[plat][semana] ??= {};

  const lista = (resp === TODAS ? ESCOLAS : ESCOLAS.filter(e => e.supervisor === resp))
                .filter(e => correspondeBusca(e, busca));

  grid.innerHTML = lista.length ? lista.map(e => `
    <article class="lancamento-linha">
      <h4>${escapar(e.nome)} <small class="codigo-escola">(${e.codigo})</small></h4>
      <input type="number" data-codigo="${e.codigo}" min="0" step="0.01"
             inputmode="decimal" value="${lancamentosPlat[plat][semana][e.codigo] ?? ""}" placeholder="Valor (0 a 10)">
    </article>`).join("")
    : '<p class="sem-dado" style="padding: 20px; text-align: center;">Nenhuma escola encontrada.</p>';
}

async function salvarPlataformasSemana() {
  const plat = $("#plat-selecionada").value;
  const semana = Number($("#semana-plat").value); const registros = [];    for (const campo of $$("#lancamento-grid-plat input")) {
    const texto = campo.value.trim();
    const valor = Number(texto);
    if (texto !== "" && (Number.isNaN(valor) || valor < 0)) {
      avisar(`Valor inválido.`, true);
      campo.focus();
      return;
    }
    const novo = texto === "" ? null : valor;
    if (novo !== (lancamentosPlat[plat]?.[semana]?.[campo.dataset.codigo] ?? null)) {
      registros.push({ codigo: campo.dataset.codigo, valor: novo });
    }
  }
  
  if (!registros.length) return avisar("Nenhuma alteração para salvar.");

  const botao = $("#salvar-plat");
  if (botao) botao.disabled = true;
  try {
    lancamentosPlat[plat] ??= {};
    lancamentosPlat[plat][semana] ??= {};
    
    registros.forEach(r => {
       if (r.valor === null) delete lancamentosPlat[plat][semana][r.codigo];
       else lancamentosPlat[plat][semana][r.codigo] = r.valor;
    });

    await docRefPlat.set(lancamentosPlat, { merge: true });
    avisar(`Dados de ${PLATAFORMAS[plat].nome} salvos na nuvem!`);
    renderizarCalculadoraPlat();
  } catch (erro) {
    console.error(erro);
    avisar("Erro ao salvar no Firebase.", true);
  } finally {
    if (botao) botao.disabled = false;
  }
}

/* =========================
   7. Fichas (modal)
   ========================= */

const tabela = (legenda, cabecalhos, linhas) => `
  <div class="tabela-rolagem" tabindex="0" role="region" aria-label="${escapar(legenda)}">
    <table>
      <caption class="sr-only">${escapar(legenda)}</caption>
      <thead><tr>${cabecalhos.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  </div>`;

function estatisticaPlataforma(chave, escola) {
  const config = PLATAFORMAS[chave];
  const campo = config.campoNota || config.campo;
  const validas = ESCOLAS.filter(e => !semValor(e[campo])).sort((a, b) => b[campo] - a[campo]);
  const indice = validas.indexOf(escola);
  return {
    posicao: indice >= 0 ? indice + 1 : null,
    total: validas.length,
    media: mediaRegistro(config, validas),
    melhor: validas.length ? validas[0] : null
  };
}

const textoPosicao = est => est.posicao ? `${est.posicao}º de ${est.total}` : "Sem dado";

function tabelaPlataformas(escola) {
  return tabela(`Resultados de ${escola.nome} por plataforma`,
    ["Plataforma", "Resultado", "Posição", "Média da URE"],
    Object.entries(PLATAFORMAS).map(([chave, p]) => {
      const est = estatisticaPlataforma(chave, escola);
      return [p.nome, textoValor(p, escola), textoPosicao(est), textoValor(p, est.media)];
    }));
}

const FICHAS = {
  ranking: e => ({
    rotulo: "Visão: ranking geral",
    html: tabela(`Posição de ${e.nome}`, ["Indicador", "Resultado"], [
      ["Posição no ranking geral", `${e.posicao}º de ${ESCOLAS.length}`],
      ["Nota final", numero(e.notaFinal)],
      ["Nota Tarefa SP", formatarNota(e.notaTarefa)],
      ["Vezes no Top 3 / Top 5 / Top 10", `${e.top3} / ${e.top5} / ${e.top10}`]
    ]) + "<h3>Posição por plataforma</h3>" + tabelaPlataformas(e)
  }),

  plataforma: e => {
    const p = PLATAFORMAS[plataformaAtual];
    const est = estatisticaPlataforma(plataformaAtual, e);
    const campoDif = p.campoNota || p.campo;
    const diferenca = semValor(e[p.campo]) || est.media === null ? "Sem dado" : numero(e[campoDif] - est.media[campoDif], p.casas);
    return {
      rotulo: `Visão: plataforma ${p.nome}`,
      html: tabela(`${e.nome} em ${p.nome}`, ["Indicador", "Resultado"], [
        ["Resultado", textoValor(p, e)],
        ["Posição", textoPosicao(est)],
        ["Média da URE", textoValor(p, est.media)],
        ["Diferença para a média", diferenca]
      ]) + "<h3>Todas as plataformas</h3>" + tabelaPlataformas(e)
    };
  },

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
        ["Média necessária", necessaria === null ? "Meta já atingida" : formatarPontos(necessaria)],
        ["Situação", seloSituacao(situacaoIFA(e))]
      ]) + "<h3>Presença por período</h3>" + tabela(`Período`, ["Período", "Presença", "Status"], periodos)
    };
  },

  escolas: e => ({
    rotulo: "Visão: ficha completa",
    html: tabela(`Resumo de ${e.nome}`, ["Indicador", "Resultado"], [
      ["Ranking geral", `${e.posicao}º de ${ESCOLAS.length}`],
      ["Nota final", numero(e.notaFinal)],
      ["Presença consolidada", formatarPontos(presencaAtual(e).media)],
      ["IFA da escola", formatarPontos(e.ifa)],
      ["Supervisor(a)", botaoSupervisor(e.supervisor)]
    ]) + "<h3>Desempenho por plataforma</h3>" + tabelaPlataformas(e)
  })
};

function mostrarModal() {
  const modal = $("#modal-escola");
  if (modal && !modal.open) modal.showModal();
}

function abrirFicha(codigo, contexto = "escolas") {
  const escola = buscarEscola(codigo);
  if (!escola) return;
  const { rotulo, html } = (FICHAS[contexto] || FICHAS.escolas)(escola);

  $("#modal-titulo").textContent = nomeCompleto(escola);
  $("#modal-conteudo").innerHTML = `<p class="contexto-ficha">${escapar(rotulo)}</p>${html}`;
  mostrarModal();
}

function abrirSupervisor(nome) {
  const sup = rankingSupervisores().find(s => s.nome === nome);
  if (!sup) return;

  $("#modal-titulo").textContent = sup.nome;
  $("#modal-conteudo").innerHTML = `
    <p class="contexto-ficha">Visão: supervisão (${sup.posicao}º no ranking)</p>
    ${tabela(`Escolas de ${sup.nome}`, ["Escola", "Nota final", "Presença", "IFA", "Situação"],
      [...sup.escolas].sort(ORDENACOES.ranking).map(e => [
        botaoEscola(e, "escolas"), numero(e.notaFinal), formatarPontos(presencaAtual(e).media),
        formatarPontos(e.ifa), seloSituacao(situacaoIFA(e))
      ]))}`;
  mostrarModal();
}

/* =========================
   8. Inicialização
   ========================= */

function configurarEventos() {
  document.addEventListener("click", evento => {
    const escola = evento.target.closest(".escola-link");
    if (escola) return abrirFicha(escola.dataset.codigo, escola.dataset.contexto);

    const supervisor = evento.target.closest(".supervisor-link");
    if (supervisor) abrirSupervisor(supervisor.dataset.supervisor);
  });

  $$(".menu-botao").forEach(botao => botao.addEventListener("click", () => {
    $$(".menu-botao").forEach(b => { b.classList.remove("ativo"); b.removeAttribute("aria-current"); }); botao.classList.add("ativo"); botao.setAttribute("aria-current", "page");      $$
(".visao").forEach(secao => secao.classList.remove("ativa"));
    $(`#view-${botao.dataset.view}`).classList.add("ativa");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));

  const ligar = (ids, evento, funcao) => ids.forEach(id => $(id)?.addEventListener(evento, funcao));
  
  ligar(["#busca-escola"], "input", renderizarEscolas);
  ligar(["#filtro-supervisor", "#ordenar-escolas"], "change", renderizarEscolas);
  ligar(["#busca-plataforma"], "input", renderizarPlataformas);
  ligar(["#busca-ifa"], "input", renderizarIFA);
  ligar(["#filtro-situacao-ifa", "#ordenar-ifa"], "change", renderizarIFA);

  ligar(["#limpar-filtros"], "click", () => {
    $("#busca-escola").value = "";
    $("#filtro-supervisor").value = "";
    $("#ordenar-escolas").value = "ranking";
    renderizarEscolas();
  });
  
  ligar(["#limpar-ifa"], "click", () => {
    $("#busca-ifa").value = "";
    $("#filtro-situacao-ifa").value = "";
    $("#ordenar-ifa").value = "presenca";
    renderizarIFA();
  });

  // Calculadoras
  ligar(["#semana-calculadora", "#responsavel-lancamento"], "change", renderizarCalculadora);
  ligar(["#busca-calculadora"], "input", renderizarCalculadora);
  ligar(["#calcular-semana"], "click", calcularSemana);

  ligar(["#plat-selecionada", "#semana-plat", "#responsavel-plat"], "change", renderizarCalculadoraPlat);
  ligar(["#busca-plat-calc"], "input", renderizarCalculadoraPlat);
  ligar(["#salvar-plat"], "click", salvarPlataformasSemana);

  document.addEventListener("visibilitychange", () => { if (!document.hidden) carregarRemoto(); });

  ligar(["#fechar-modal"], "click", () => $("#modal-escola")?.close());
  $("#modal-escola")?.addEventListener("click", evento => {
    if (evento.target.id === "modal-escola") $("#modal-escola").close();
  });
}

function iniciar() {
  configurarEventos();
  preencherSupervisores();
  preencherResponsaveis();
  preencherFiltrosPlataformas();
  montarAbasPlataforma();
  atualizarTudo();
  renderizarPlataformas();
  renderizarCalculadora();
  renderizarCalculadoraPlat();
  definirSincronizacao("Conectando à base Firebase…");
  carregarRemoto();
}

document.addEventListener("DOMContentLoaded", iniciar);
