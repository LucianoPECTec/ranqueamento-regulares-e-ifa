/* =========================================================
   analise-paulista.js — CÁLCULOS da Prova Paulista (sem tela)
   ---------------------------------------------------------
   Escolas: comparam o primeiro e o último bimestre que têm dado por escola.
   Componentes: usam o total da URE (PAULISTA.ure), que cobre os 3 bimestres.
   Variação = último bimestre MENOS o primeiro, em pontos percentuais (p.p.).
   ========================================================= */
"use strict";

const ehNumero = v => typeof v === "number" && !isNaN(v);
const mediaDe = lista => lista.length ? lista.reduce((t, v) => t + v, 0) / lista.length : null;

// Nota geral de uma escola num bimestre: usa "geral" ou a média dos componentes
function geralDoBimestre(registro) {
  if (!registro) return null;
  if (ehNumero(registro.geral)) return registro.geral;
  return mediaDe(Object.values(registro.componentes || {}).filter(ehNumero));
}

// Bimestres em que existe dado de ESCOLA, ex.: [2, 3]
function bimestresDasEscolas() {
  const achados = new Set();
  Object.values(PAULISTA.resultados).forEach(porBim =>
    Object.keys(porBim).forEach(b => { if (geralDoBimestre(porBim[b]) !== null) achados.add(Number(b)); }));
  return [...achados].sort((a, b) => a - b);
}

// Grau da regressão a partir da queda (valor positivo, em p.p.)
function grauDaQueda(queda) {
  const { leve, moderada } = PAULISTA.grauRegressao;
  return queda <= leve ? "Leve" : queda <= moderada ? "Moderada" : "Forte";
}

function analisarPaulista() {
  const meta = PAULISTA.metaPercentual;
  const bimsE = bimestresDasEscolas();
  if (!bimsE.length) return { vazio: true };

  const primeiroE = bimsE[0], ultimoE = bimsE[bimsE.length - 1];
  const ure = PAULISTA.ure || {};
  const bimsU = [...new Set([...bimsE, ...Object.keys(ure).map(Number)])].sort((a, b) => a - b);
  const primeiroU = bimsU[0], ultimoU = bimsU[bimsU.length - 1];

  /* ---------- 1) Escolas ---------- */
  const escolas = [];
  ESCOLAS.forEach(escola => {
    const porBim = PAULISTA.resultados[escola.codigo];
    if (!porBim) return;
    const geral = {};
    bimsE.forEach(b => { geral[b] = geralDoBimestre(porBim[b]); });
    if (geral[ultimoE] === null) return;

    const variacao = (primeiroE !== ultimoE && geral[primeiroE] !== null) ? geral[ultimoE] - geral[primeiroE] : null;
    const mantem50 = bimsE.every(b => geral[b] !== null && geral[b] >= meta);
    const atual = geral[ultimoE];
    const deficit = Math.max(0, meta - atual);
    const queda = variacao !== null && variacao < 0 ? -variacao : 0;
    const motivos = [];
    if (deficit > 0) motivos.push(`abaixo de ${meta}%`);
    if (queda > 0) motivos.push(`queda de ${queda.toFixed(1).replace(".", ",")} p.p.`);

    escolas.push({ escola, geral, atual, variacao, mantem50,
      grau: queda > 0 ? grauDaQueda(queda) : null,
      pontosAtencao: deficit + queda * PAULISTA.pesoQueda, motivos });
  });

  /* ---------- 2) Total da URE por bimestre (usa o oficial; senão, média das escolas) ---------- */
  const totalURE = b => {
    if (ure[b]) return ure[b];
    const regs = escolas.map(e => PAULISTA.resultados[e.escola.codigo][b]).filter(Boolean);
    const comps = {};
    regs.forEach(r => Object.keys(r.componentes || {}).forEach(n => {
      comps[n] = mediaDe(regs.map(x => x.componentes?.[n]).filter(ehNumero));
    }));
    return { geral: mediaDe(regs.map(geralDoBimestre).filter(ehNumero)), componentes: comps };
  };
  const mediaURE = Object.fromEntries(bimsU.map(b => [b, totalURE(b).geral ?? null]));

  /* ---------- 3) Componentes da URE ---------- */
  const nomes = new Set();
  bimsU.forEach(b => Object.keys(totalURE(b).componentes || {}).forEach(n => nomes.add(n)));

  const componentes = [...nomes].map(nome => {
    const media = {};
    bimsU.forEach(b => { const v = totalURE(b).componentes?.[nome]; media[b] = ehNumero(v) ? v : null; });
    const variacao = (primeiroU !== ultimoU && media[primeiroU] !== null && media[ultimoU] !== null)
      ? media[ultimoU] - media[primeiroU] : null;

    // Quantas escolas melhoraram / pioraram no componente (no período das escolas)
    let cresceram = 0, regrediram = 0;
    escolas.forEach(e => {
      const r = PAULISTA.resultados[e.escola.codigo];
      const a = r[primeiroE]?.componentes?.[nome], z = r[ultimoE]?.componentes?.[nome];
      if (primeiroE !== ultimoE && ehNumero(a) && ehNumero(z)) { if (z > a) cresceram++; else if (z < a) regrediram++; }
    });
    return { nome, media, variacao, cresceram, regrediram,
      mantem50: bimsU.every(b => media[b] !== null && media[b] >= meta) };
  });

  /* ---------- 4) Listas prontas para as tabelas ---------- */
  const ordem = (lista, chave, desc = true) => [...lista].sort((a, b) => desc ? chave(b) - chave(a) : chave(a) - chave(b));
  const comVar = escolas.filter(e => e.variacao !== null);
  const compVar = componentes.filter(c => c.variacao !== null);
  const porNota = ordem(escolas, e => e.atual);

  return {
    vazio: false, meta, totalEscolas: escolas.length,
    bimsE, primeiroE, ultimoE, comparavelE: primeiroE !== ultimoE,
    bimsU, primeiroU, ultimoU, comparavelU: primeiroU !== ultimoU,
    mediaURE, escolas: porNota, melhor: porNota[0],
    maisCresceram: ordem(comVar.filter(e => e.variacao > 0), e => e.variacao),
    mantiveram50: ordem(escolas.filter(e => e.mantem50), e => e.atual),
    regrediram: ordem(comVar.filter(e => e.variacao < 0), e => e.variacao, false),
    atencao: ordem(escolas.filter(e => e.pontosAtencao > 0), e => e.pontosAtencao),
    componentes,
    compEvoluiram: ordem(compVar.filter(c => c.variacao > 0), c => c.variacao),
    compMantiveram50: componentes.filter(c => c.mantem50),
    compRegrediram: ordem(compVar.filter(c => c.variacao < 0), c => c.variacao, false)
  };
}
