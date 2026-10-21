/* =========================================================
   Monitoramento Escolar — URE São José do Rio Preto
   Arquivo: graficos.js  |  Escopo: ESCOLAS REGULARES
   ---------------------------------------------------------
   Gráficos em SVG puro (sem bibliotecas), com download em PNG e SVG.
   ========================================================= */
"use strict";

/* =========================
   1. Cores e utilidades
   ========================= */

const COR = {
  azul: "#1d5b8f", escuro: "#10375c", trilho: "#e6edf3", texto: "#2f3943", suave: "#55616c",
  verde: "#1e7e4e", amarelo: "#d99a00", vermelho: "#c0504d",
  ouro: "#f2c230", prata: "#aeb8c2", bronze: "#d9955a"
};
const MEDALHAS = [COR.ouro, COR.prata, COR.bronze];
const LARGURA = 760;
const FONTE = 'font-family="system-ui, Segoe UI, Roboto, Arial, sans-serif"';
const COR_SITUACAO = { "Dentro do IFA": COR.verde, "Em acompanhamento": COR.amarelo, "Fora do alcance da meta": COR.vermelho };

function nomeCurto(nome, limite = 30) {
  const pequenas = ["da", "de", "do", "das", "dos", "e"];
  const texto = nome.toLowerCase().split(" ")
    .map((p, i) => /^(i{1,3}|iv|v)$/.test(p) ? p.toUpperCase() 
      : (i && pequenas.includes(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  return texto.length > limite ? texto.slice(0, limite - 1) + "…" : texto;
}

function moldura(titulo, subtitulo, altura, corpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA} ${altura}" width="${LARGURA}" height="${altura}" role="img" aria-label="${escapar(titulo)}. ${escapar(subtitulo)}" ${FONTE}>
  <rect width="${LARGURA}" height="${altura}" rx="16" fill="#fff"/>
  <rect width="${LARGURA}" height="8" rx="4" fill="${COR.azul}"/>
  <text x="28" y="46" font-size="22" font-weight="800" fill="${COR.escuro}">${escapar(titulo)}</text>
  <text x="28" y="68" font-size="13" fill="${COR.suave}">${escapar(subtitulo)}</text>
  ${corpo}
  <text x="28" y="${altura - 14}" font-size="11" fill="${COR.suave}">URE São José do Rio Preto · Escolas regulares · Levantamento até a semana ${CONFIG.semanasConcluidas}</text>
</svg>`;
}

function legenda(itens, y) {
  let x = 28;
  return itens.map(i => {
    const bloco = `<rect x="${x}" y="${y - 10}" width="12" height="12" rx="3" fill="${i.cor}"/>
      <text x="${x + 18}" y="${y}" font-size="12" fill="${COR.texto}">${escapar(i.rotulo)}</text>`;
    x += 54 + i.rotulo.length * 7.2;
    return bloco;
  }).join("");
}

/* =========================
   2. Tipos de gráfico
   ========================= */

function barras({ titulo, subtitulo, itens, min = 0, max, ref, chaves }) {
  const topo = chaves ? 124 : 104, linha = 30, rotuloX = 275, area = 335;
  const altura = topo + itens.length * linha + 46;
  const x = v => rotuloX + Math.max(((v - min) / (max - min)) * area, 4);
  const sub = min > 0 ? `${subtitulo} · eixo a partir de ${numero(min, 0)}` : subtitulo;

  const corpo = itens.map((it, i) => {
    const y = topo + i * linha;
    return `<text x="${rotuloX - 10}" y="${y + 16}" text-anchor="end" font-size="13" fill="${COR.texto}">${escapar(it.rotulo)}</text>
    <rect x="${rotuloX}" y="${y + 4}" width="${area}" height="16" rx="8" fill="${COR.trilho}"/>
    <rect x="${rotuloX}" y="${y + 4}" width="${Math.max(x(it.valor) - rotuloX, 0)}" height="16" rx="8" fill="${it.cor || COR.azul}"/>
    <text x="${rotuloX + area + 12}" y="${y + 17}" font-size="13" font-weight="700" fill="${COR.escuro}">${escapar(it.texto)}</text>`;
  }).join("");

  // Linha da Meta URE renderizada no final para ficar sobre as barras
  const meta = ref ? `<line x1="${x(ref.valor)}" y1="${topo - 4}" x2="${x(ref.valor)}" y2="${topo + itens.length * linha}" stroke="${COR.escuro}" stroke-width="2" stroke-dasharray="5 4"/>
    <text x="${x(ref.valor)}" y="${topo - 10}" text-anchor="middle" font-size="12" font-weight="700" fill="${COR.escuro}">${escapar(ref.rotulo)}</text>` : "";

  return moldura(titulo, sub, altura, (chaves ? legenda(chaves, 92) : "") + corpo + meta);
}

function divergentes({ titulo, subtitulo, itens, min, max }) {
  const topo = 104, linha = 30, rotuloX = 275, area = 335;
  const altura = topo + itens.length * linha + 46;
  
  const x = v => rotuloX + ((v - min) / (max - min)) * area;
  const zeroX = x(0);

  const corpo = itens.map((it, i) => {
    const y = topo + i * linha;
    const width = Math.abs(x(it.valor) - zeroX);
    const bx = it.valor < 0 ? x(it.valor) : zeroX;
    
    const tx = it.valor < 0 ? bx - 8 : bx + width + 8;
    const tAnchor = it.valor < 0 ? "end" : "start";

    return `<text x="${rotuloX - 10}" y="${y + 16}" text-anchor="end" font-size="13" fill="${COR.texto}">${escapar(it.rotulo)}</text>
    <rect x="${bx}" y="${y + 4}" width="${Math.max(width, 2)}" height="16" rx="4" fill="${it.cor}"/>
    <text x="${tx}" y="${y + 17}" text-anchor="${tAnchor}" font-size="13" font-weight="700" fill="${COR.escuro}">${escapar(it.texto)}</text>`;
  }).join("");

  return moldura(titulo, subtitulo, altura, `<line x1="${zeroX}" y1="${topo - 4}" x2="${zeroX}" y2="${topo + itens.length * linha}" stroke="${COR.escuro}" stroke-width="2" stroke-dasharray="4 4"/>` + corpo);
}

function rosca({ titulo, subtitulo, itens }) {
  const total = itens.reduce((t, i) => t + i.valor, 0) || 1;
  const cx = 190, cy = 230, r = 100, espessura = 44, C = 2 * Math.PI * r;
  let deslocamento = 0;

  const arcos = itens.filter(i => i.valor > 0).map(i => {
    const tamanho = (i.valor / total) * C;
    const arco = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i.cor}" stroke-width="${espessura}"
      stroke-dasharray="${tamanho} ${C - tamanho}" stroke-dashoffset="${-deslocamento}" transform="rotate(-90 ${cx} ${cy})"/>`;
    deslocamento += tamanho;
    return arco;
  }).join("");

  const itensLegenda = itens.map((i, n) => `
    <rect x="390" y="${170 + n * 62}" width="18" height="18" rx="4" fill="${i.cor}"/>
    <text x="418" y="${185 + n * 62}" font-size="16" font-weight="700" fill="${COR.escuro}">${escapar(i.rotulo)}</text>
    <text x="418" y="${205 + n * 62}" font-size="14" fill="${COR.suave}">${i.valor} escola(s) · ${numero(i.valor / total * 100, 0)}%</text>`).join("");

  return moldura(titulo, subtitulo, 400, `${arcos}
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="34" font-weight="800" fill="${COR.escuro}">${total}</text>
    <text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="13" fill="${COR.suave}">escolas</text>${itensLegenda}`);
}

function colunas({ titulo, subtitulo, itens, min = 0, max, ref }) {
  const x0 = 70, area = 650, base = 350, alto = 220, largura = area / itens.length;
  const y = v => base - ((v - min) / (max - min)) * alto;
  const sub = min > 0 ? `${subtitulo} · eixo a partir de ${numero(min, 0)}` : subtitulo;

  const corpo = itens.map((it, i) => {
    const cx = x0 + i * largura + largura / 2, w = 54;
    const barra = it.valor === null
      ? `<rect x="${cx - w / 2}" y="${base - 60}" width="${w}" height="60" rx="8" fill="none" stroke="${COR.azul}" stroke-width="2" stroke-dasharray="5 4"/>`
      : `<rect x="${cx - w / 2}" y="${y(it.valor)}" width="${w}" height="${base - y(it.valor)}" rx="8" fill="${it.cor || COR.azul}"/>`;
    const valorY = it.valor === null ? base - 70 : y(it.valor) - 8;
    return `${barra}
    <text x="${cx}" y="${valorY}" text-anchor="middle" font-size="14" font-weight="800" fill="${COR.escuro}">${escapar(it.texto)}</text>
    <text x="${cx}" y="${base + 22}" text-anchor="middle" font-size="13" font-weight="700" fill="${COR.texto}">${escapar(it.rotulo)}</text>
    <text x="${cx}" y="${base + 40}" text-anchor="middle" font-size="12" fill="${COR.suave}">${escapar(it.apoio || "")}</text>`;
  }).join("");

  const meta = ref ? `<line x1="${x0}" y1="${y(ref.valor)}" x2="${x0 + area}" y2="${y(ref.valor)}" stroke="${COR.vermelho}" stroke-width="2" stroke-dasharray="6 4"/>
    <text x="${x0 + 8}" y="${y(ref.valor) - 6}" text-anchor="start" font-size="12" font-weight="700" fill="${COR.vermelho}">${escapar(ref.rotulo)}</text>` : "";

  return moldura(titulo, sub, 440, `<line x1="${x0}" y1="${base}" x2="${x0 + area}" y2="${base}" stroke="${COR.trilho}" stroke-width="2"/>${meta}${corpo}`);
}

/* =========================
   3. Catálogo de gráficos
   ========================= */

let plataformaGrafico = "tarefa";
const medalha = i => (i < 3 ? MEDALHAS[i] : COR.azul);

const GRAFICOS = [
  {
    id: "ranking-geral",
    gerar: () => barras({
      titulo: "Ranking geral das escolas",
      subtitulo: "Nota final do desempenho multissistema · os 3 melhores em destaque",
      min: 0, max: Math.max(10, ...ESCOLAS.map(e => e.notaFinal)),
      itens: [...ESCOLAS].sort((a, b) => b.notaFinal - a.notaFinal).map((e, i) => ({
        rotulo: `${i + 1}º ${nomeCurto(e.nome, 28)}`, valor: e.notaFinal, texto: numero(e.notaFinal), cor: medalha(i)
      }))
    })
  },
  {
    id: "impacto-ifa",
    gerar: () => {
      const N = ESCOLAS.length;
      const dados = ESCOLAS.map(e => {
        const impacto = (presencaAtual(e).media - CONFIG.ifaURE) / N;
        return { e, impacto };
      }).sort((a, b) => b.impacto - a.impacto);

      const valores = dados.map(d => d.impacto);
      const limite = Math.max(Math.abs(Math.min(...valores)), Math.abs(Math.max(...valores))) * 1.15;

      return divergentes({
        titulo: "Impacto no IFA da URE",
        subtitulo: "Quantos pontos percentuais exatos (+/-) cada escola contribui para a média geral da URE",
        min: -limite, max: limite,
        itens: dados.map(({ e, impacto }) => ({
          rotulo: nomeCurto(e.nome, 34),
          valor: impacto,
          texto: `${impacto > 0 ? '+' : ''}${numero(impacto, 3)}%`,
          cor: impacto >= 0 ? COR.verde : COR.vermelho
        }))
      });
    }
  },
  {
    id: "presenca-ifa",
    gerar: () => barras({
      titulo: "Presença consolidada × IFA da URE",
      subtitulo: "O traço vertical cruza as barras marcando a meta geral de presença da URE",
      min: 70, max: 100, 
      chaves: Object.entries(COR_SITUACAO).map(([rotulo, cor]) => ({ rotulo, cor })),
      ref: { valor: CONFIG.ifaURE, rotulo: `IFA da URE ${numero(CONFIG.ifaURE, 1)}%` },
      itens: [...ESCOLAS].sort((a, b) => presencaAtual(b).media - presencaAtual(a).media).map(e => ({
        rotulo: nomeCurto(e.nome, 34), 
        valor: presencaAtual(e).media, 
        texto: `${formatarPontos(presencaAtual(e).media)} (Meta: ${numero(e.ifa, 1)}%)`,
        cor: COR_SITUACAO[situacaoIFA(e)]
      }))
    })
  },
  {
    id: "situacao-ifa",
    gerar: () => rosca({
      titulo: "Situação das escolas no IFA",
      subtitulo: "Quantas escolas estão dentro da meta, em acompanhamento ou fora do alcance",
      itens: Object.entries(COR_SITUACAO).map(([rotulo, cor]) => ({ rotulo, cor, valor: ESCOLAS.filter(e => situacaoIFA(e) === rotulo).length }))
    })
  },
  {
    id: "supervisores",
    gerar: () => barras({
      titulo: "Ranking dos supervisores",
      subtitulo: "Nota média das escolas de cada supervisor(a) · os 3 melhores em destaque",
      min: 0, max: 10,
      itens: rankingSupervisores().map((s, i) => ({
        rotulo: `${s.posicao}º ${nomeCurto(s.nome, 28)}`, valor: s.notaMedia, cor: medalha(i),
        texto: `${numero(s.notaMedia)} · ${s.escolas.length} esc.`
      }))
    })
  },
  {
    id: "semanas-ifa",
    gerar: () => {
      const semanas = projecaoSemanal().map(p => ({
        rotulo: `Semana ${p.semana}`, valor: p.mediaURE, apoio: p.estado === "lancada" ? "Lançada" : p.estado === "parcial" ? "Parcial" : "Prevista",
        texto: p.mediaURE === null ? "—" : formatarPontos(p.mediaURE, 1)
      }));
      const fechamento = media(ESCOLAS, presencaProjetada);
      semanas.push({ rotulo: "Fechamento", valor: fechamento, apoio: "Projeção", texto: formatarPontos(fechamento, 1), cor: COR.escuro });
      return colunas({
        titulo: "Presença da URE nas próximas semanas",
        subtitulo: "Média lançada em cada semana e projeção de fechamento · linha = IFA da URE",
        itens: semanas, min: 60, max: 100, ref: { valor: CONFIG.ifaURE, rotulo: `IFA da URE ${numero(CONFIG.ifaURE, 1)}%` }
      });
    }
  },
  {
    id: "plataforma",
    gerar: () => {
      const config = PLATAFORMAS[plataformaGrafico];
      const campo = config.campoNota || config.campo;
      const lista = ESCOLAS.filter(e => !semValor(e[campo])).sort((a, b) => b[campo] - a[campo]);
      return barras({
        titulo: `${config.nome} — resultado por escola`,
        subtitulo: config.campoNota ? "Ranqueado pela nota (nota · percentual)" : "Do maior para o menor resultado",
        min: 0, max: lista.length ? lista[0][campo] : 1,
        itens: lista.map((e, i) => ({
          rotulo: `${i + 1}º ${nomeCurto(e.nome, 28)}`, valor: e[campo], cor: medalha(i),
          texto: config.campoNota ? `${formatarNota(e[config.campoNota])} · ${formatarPlataforma(config, e[config.campo])}` : formatarPlataforma(config, e[campo])
        }))
      });
    }
  }
];

/* =========================
   4. Tela e downloads
   ========================= */

const svgsAtuais = {};

function renderizarGraficos() {
  const area = $("#area-graficos");
  if (!area) return;

  const seletor = `<label for="grafico-plataforma">Plataforma</label>
    <select id="grafico-plataforma">${Object.entries(PLATAFORMAS).map(([chave, p]) =>
      `<option value="${chave}" ${chave === plataformaGrafico ? "selected" : ""}>${p.nome}</option>`).join("")}</select>`;

  area.innerHTML = GRAFICOS.map(g => {
    svgsAtuais[g.id] = g.gerar();
    return `<figure class="grafico" data-id="${g.id}">
      <div class="grafico-barra">
        ${g.id === "plataforma" ? seletor : ""}
        <button type="button" class="botao-secundario" data-baixar="png">Baixar PNG</button>
        <button type="button" class="botao-secundario" data-baixar="svg">Baixar SVG</button>
      </div>
      <div class="grafico-rolagem">${svgsAtuais[g.id]}</div>
    </figure>`;
  }).join("");
}

function salvarArquivo(blob, nome) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function baixarGrafico(id, formato) {
  const nome = `grafico-${id}-semana-${CONFIG.semanasConcluidas}`;
  const svg = svgsAtuais[id];
  if (formato === "svg") return salvarArquivo(new Blob([svg], { type: "image/svg+xml" }), `${nome}.svg`);

  const imagem = new Image();
  imagem.onload = () => {
    const escala = 2, tela = document.createElement("canvas");
    tela.width = imagem.naturalWidth * escala;
    tela.height = imagem.naturalHeight * escala;
    const contexto = tela.getContext("2d");
    contexto.scale(escala, escala);
    contexto.drawImage(imagem, 0, 0);
    tela.toBlob(blob => salvarArquivo(blob, `${nome}.png`), "image/png");
  };
  imagem.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

document.addEventListener("DOMContentLoaded", () => {
  const area = $("#area-graficos");
  if (!area) return;

  area.addEventListener("click", evento => {
    const botao = evento.target.closest("[data-baixar]");
    if (botao) baixarGrafico(botao.closest(".grafico").dataset.id, botao.dataset.baixar);
  });
  area.addEventListener("change", evento => {
    if (evento.target.id !== "grafico-plataforma") return;
    plataformaGrafico = evento.target.value;
    renderizarGraficos();
    $("#grafico-plataforma").focus();
  });
  $("#baixar-todos").addEventListener("click", () =>
    GRAFICOS.forEach((g, i) => setTimeout(() => baixarGrafico(g.id, "png"), i * 600)));
});
