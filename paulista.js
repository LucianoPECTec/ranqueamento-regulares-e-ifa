/* =========================================================
   paulista.js — TELA da aba "Prova Paulista"
   Usa analisarPaulista() e desenha KPIs e tabelas.
   Carregue DEPOIS do app.js (usa escapar e botaoEscola dele).
   ========================================================= */
"use strict";

const pt1 = v => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPct = v => v === null || v === undefined ? "Sem dado" : pt1(v) + "%";

// Variação com sinal e cor: +3,2 p.p. (verde) / -1,5 p.p. (vermelho)
function fmtVar(v) {
  if (v === null || v === undefined) return '<span class="sem-dado">—</span>';
  const classe = v > 0 ? "var-positiva" : v < 0 ? "var-negativa" : "var-neutra";
  return `<span class="${classe}">${v > 0 ? "+" : ""}${pt1(v)} p.p.</span>`;
}

const nomeEscolaPaulista = e => typeof botaoEscola === "function" ? botaoEscola(e.escola, "escolas") : escapar(e.escola.nome);
const rotuloBim = b => PAULISTA.nomesBimestres[b] || `${b}º Bim.`;
const nomeComp = sigla => (PAULISTA.nomesComponentes && PAULISTA.nomesComponentes[sigla]) || sigla;

// Painel com tabela (mesmas classes do restante do painel)
function painelPaulista(titulo, descricao, cabecalhos, linhas) {
  const corpo = linhas.length ? linhas.join("")
    : `<tr><td colspan="${cabecalhos.length}" class="sem-dado">Nenhuma escola ou componente nesta situação.</td></tr>`;
  return `<section class="painel">
    <header class="painel-cabecalho"><h3>${titulo}</h3><p>${descricao}</p></header>
    <div class="tabela-rolagem" tabindex="0" role="region" aria-label="Tabela: ${titulo}">
      <table><caption class="sr-only">${titulo}</caption>
        <thead><tr>${cabecalhos.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
        <tbody>${corpo}</tbody></table></div></section>`;
}

function renderizarPaulista() {
  const area = document.getElementById("area-paulista");
  if (!area) return;
  if (typeof PAULISTA === "undefined" || typeof analisarPaulista !== "function") return;

  const A = analisarPaulista();
  if (A.vazio) {
    area.innerHTML = `<aside class="aviso"><p><strong>Aguardando os resultados.</strong>
      Preencha o arquivo <code>dados-paulista.js</code> e atualize a página.</p></aside>`;
    return;
  }

  const { meta, bimsE, bimsU, primeiroE, ultimoE, primeiroU, ultimoU } = A;
  const perE = A.comparavelE ? `${rotuloBim(primeiroE)} → ${rotuloBim(ultimoE)}` : rotuloBim(ultimoE);
  const perU = A.comparavelU ? `${rotuloBim(primeiroU)} → ${rotuloBim(ultimoU)}` : rotuloBim(ultimoU);
  const cabE = bimsE.map(rotuloBim), cabU = bimsU.map(rotuloBim);
  const colE = (e) => bimsE.map(b => `<td>${fmtPct(e.geral[b])}</td>`).join("");

  const kpi = (titulo, valor, apoio) => `<article class="indicador"><h3>${titulo}</h3>
    <p class="valor">${valor}</p><p class="apoio">${apoio}</p></article>`;
  const varURE = A.comparavelU ? fmtVar(A.mediaURE[ultimoU] - A.mediaURE[primeiroU]) : "";

  const avisoE = A.comparavelE ? "" : `<aside class="aviso"><p>Só há um bimestre por escola. Os comparativos de escolas aparecem quando houver dois ou mais.</p></aside>`;
  const notaE = `<aside class="aviso"><p>Comparativos de <strong>escolas</strong>: ${perE} (regulares).
    Comparativos de <strong>componentes</strong>: total da URE, ${perU}.</p></aside>`;

  const kpis = `<section class="indicadores" aria-label="Indicadores da Prova Paulista">
    ${kpi("Melhor desempenho", nomeEscolaPaulista(A.melhor), `${fmtPct(A.melhor.atual)} no ${rotuloBim(ultimoE)}`)}
    ${kpi("Média da URE", fmtPct(A.mediaURE[ultimoU]), `${rotuloBim(ultimoU)} · ${varURE} (${perU})`)}
    ${kpi("Escolas que cresceram", A.maisCresceram.length, `de ${A.totalEscolas} escolas · ${perE}`)}
    ${kpi("Escolas que regrediram", A.regrediram.length, `de ${A.totalEscolas} escolas · ${perE}`)}
    ${kpi(`Mantiveram ≥ ${meta}%`, A.mantiveram50.length, `em todos os bimestres das escolas`)}
  </section>`;

  const desempenho = painelPaulista("Desempenho das escolas", `Média geral por bimestre, ordenada pelo ${rotuloBim(ultimoE)}.`,
    ["Escola", ...cabE, "Variação", "Situação"],
    A.escolas.map(e => `<tr><td>${nomeEscolaPaulista(e)}</td>${colE(e)}<td>${fmtVar(e.variacao)}</td>
      <td>${e.atual >= meta ? `<span class="selo selo-dentro">≥ ${meta}%</span>` : `<span class="selo selo-fora">&lt; ${meta}%</span>`}</td></tr>`));

  const cresceram = painelPaulista("Escolas que mais cresceram", `Maior ganho em pontos percentuais (${perE}).`,
    ["#", "Escola", rotuloBim(primeiroE), rotuloBim(ultimoE), "Crescimento"],
    A.maisCresceram.map((e, i) => `<tr><td>${i + 1}º</td><td>${nomeEscolaPaulista(e)}</td><td>${fmtPct(e.geral[primeiroE])}</td><td>${fmtPct(e.geral[ultimoE])}</td><td>${fmtVar(e.variacao)}</td></tr>`));

  const mantiveram = painelPaulista(`Escolas que se mantiveram ≥ ${meta}% no geral`, "Na meta em todos os bimestres com dado.",
    ["Escola", ...cabE, "Variação"],
    A.mantiveram50.map(e => `<tr><td>${nomeEscolaPaulista(e)}</td>${colE(e)}<td>${fmtVar(e.variacao)}</td></tr>`));

  const regrediram = painelPaulista("Escolas que regrediram", "Da maior queda para a menor, com o grau da regressão.",
    ["Escola", rotuloBim(primeiroE), rotuloBim(ultimoE), "Queda", "Grau"],
    A.regrediram.map(e => `<tr><td>${nomeEscolaPaulista(e)}</td><td>${fmtPct(e.geral[primeiroE])}</td><td>${fmtPct(e.geral[ultimoE])}</td><td>${fmtVar(e.variacao)}</td>
      <td><span class="selo ${e.grau === "Forte" ? "selo-fora" : "selo-acompanhamento"}">${e.grau}</span></td></tr>`));

  const atencao = painelPaulista("Maiores pontos de atenção", `Pontuação = distância até ${meta}% + queda × ${PAULISTA.pesoQueda}. Quanto maior, mais urgente.`,
    ["#", "Escola", rotuloBim(ultimoE), "Motivo", "Pontuação"],
    A.atencao.map((e, i) => `<tr><td>${i + 1}º</td><td>${nomeEscolaPaulista(e)}</td><td>${fmtPct(e.atual)}</td><td>${escapar(e.motivos.join(" e "))}</td>
      <td><strong>${e.pontosAtencao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong></td></tr>`));

  const linhaComp = c => `<tr><td>${escapar(nomeComp(c.nome))}</td>${bimsU.map(b => `<td>${fmtPct(c.media[b])}</td>`).join("")}<td>${fmtVar(c.variacao)}</td>
    <td>${c.cresceram} ↑ · ${c.regrediram} ↓</td></tr>`;
  const cabComp = ["Componente", ...cabU, "Variação", `Escolas (${perE})`];
  const compEvol = painelPaulista("Componentes que mais evoluíram na URE", `Total da URE, ${perU}: do maior ganho para o menor.`, cabComp, A.compEvoluiram.map(linhaComp));
  const compMant = painelPaulista(`Componentes que se mantiveram ≥ ${meta}%`, `Total da URE na meta em todos os bimestres (${perU}).`, cabComp, A.compMantiveram50.map(linhaComp));
  const compReg = painelPaulista("Componentes que mais regrediram", `Total da URE, ${perU}: da maior queda para a menor.`, cabComp, A.compRegrediram.map(linhaComp));

  area.innerHTML = avisoE + notaE + kpis + desempenho + cresceram + mantiveram + regrediram + atencao + compEvol + compMant + compReg;
}

document.addEventListener("DOMContentLoaded", renderizarPaulista);
