/* =========================================================
   Monitoramento Escolar — URE São José do Rio Preto
   Arquivo: app.js
   Compatível com index.html semântico e styles.css refeito
   ========================================================= */

const CHAVE_ARMAZENAMENTO = "lancamentosIFA-URE-SJRP";

let lancamentos = carregarLancamentos();

/* =========================
   Utilidades
   ========================= */

const $ = seletor => document.querySelector(seletor);
const $$ = seletor => Array.from(document.querySelectorAll(seletor));

function numero(valor, casas = 2) {
  if (valor === null || valor === undefined || valor === "") return "Sem dado";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function percentual(valor, casas = 2) {
  if (valor === null || valor === undefined || valor === "") return "Sem dado";
  return `${numero(valor * 100, casas)}%`;
}

function nomeCompleto(escola) {
  return `${escola.nome} - ${escola.codigo}`;
}

function buscarEscolaPorCodigo(codigo) {
  return ESCOLAS.find(escola => escola.codigo === String(codigo));
}

/* =========================
   Cálculo do IFA
   ========================= */

function presencaAtual(escola) {
  const codigo = escola.codigo;
  let soma = escola.presenca * CONFIG.semanasConcluidas * 100;
  let semanas = CONFIG.semanasConcluidas;

  for (let semana = CONFIG.semanasConcluidas + 1; semana <= CONFIG.semanaFinal; semana++) {
    const valor = lancamentos?.[semana]?.[codigo];

    if (valor !== undefined && valor !== null && valor !== "") {
      soma += Number(valor);
      semanas++;
    }
  }

  return {
    soma,
    semanas,
    media: semanas > 0 ? soma / semanas : 0
  };
}

function semanasRestantes(escola) {
  const atual = presencaAtual(escola);
  return Math.max(0, CONFIG.semanaFinal - atual.semanas);
}

function mediaNecessaria(escola) {
  const atual = presencaAtual(escola);
  const restantes = semanasRestantes(escola);

  if (restantes === 0) return null;

  return (CONFIG.semanaFinal * escola.ifa - atual.soma) / restantes;
}

function situacaoIFA(escola) {
  const atual = presencaAtual(escola);
  const necessaria = mediaNecessaria(escola);

  if (atual.media >= escola.ifa) return "Dentro do IFA";
  if (necessaria === null) return "Dentro do IFA";
  if (necessaria > 100) return "Fora do alcance da meta";
  return "Em acompanhamento";
}

function classeSelo(situacao) {
  if (situacao === "Dentro do IFA") return "selo selo-dentro";
  if (situacao === "Fora do alcance da meta") return "selo selo-fora";
  return "selo selo-acompanhamento";
}

/* =========================
   Armazenamento local
   ========================= */

function carregarLancamentos() {
  try {
    const salvo = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    return salvo ? JSON.parse(salvo) : structuredClone(LANCAMENTOS_SEMANAIS);
  } catch (erro) {
    console.warn("Não foi possível carregar os lançamentos salvos.", erro);
    return structuredClone(LANCAMENTOS_SEMANAIS);
  }
}

function salvarLancamentos() {
  localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(lancamentos));
}

/* =========================
   Navegação
   ========================= */

function configurarNavegacao() {
  $$(".menu-botao").forEach(botao => {
    botao.addEventListener("click", () => {
      const destino = botao.dataset.view;

      $$(".menu-botao").forEach(item => item.classList.remove("ativo"));
      botao.classList.add("ativo");

      $$(".visao").forEach(secao => secao.classList.remove("ativa"));
      $(`#view-${destino}`).classList.add("ativa");

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  });
}

/* =========================
   Visão geral
   ========================= */

function renderizarVisaoGeral() {
  $("#kpi-escolas").textContent = ESCOLAS.length;

  $("#kpi-ranking").textContent = ESCOLAS[0].nome;

  const maiorNota = [...ESCOLAS].sort(
    (a, b) => b.notaFinal - a.notaFinal
  )[0];

  const maiorPresenca = [...ESCOLAS].sort(
    (a, b) => presencaAtual(b).media - presencaAtual(a).media
  )[0];

  $("#kpi-nota").textContent = maiorNota.nome;
  $("#kpi-presenca").textContent = maiorPresenca.nome;

  const dentroDoIFA = ESCOLAS.filter(
    escola => situacaoIFA(escola) === "Dentro do IFA"
  ).length;

  $("#kpi-ifa").textContent = `${dentroDoIFA} de ${ESCOLAS.length}`;

  const corpo = $("#tabela-resumo");
  corpo.innerHTML = "";

  ESCOLAS.forEach(escola => {
    const atual = presencaAtual(escola);
    const situacao = situacaoIFA(escola);

    const linha = document.createElement("tr");

    linha.innerHTML = `
      <td>${escola.posicao}º</td>
      <td>
        <button
          type="button"
          class="escola-link"
          data-codigo="${escola.codigo}"
        >
          ${nomeCompleto(escola)}
        </button>
      </td>
      <td>${numero(escola.notaFinal)}</td>
      <td>${percentual(atual.media)}</td>
      <td>${percentual(escola.ifa / 100)}</td>
      <td>
        <span class="${classeSelo(situacao)}">${situacao}</span>
      </td>
    `;

    corpo.appendChild(linha);
  });

  configurarLinksEscola();
}

/* =========================
   Escolas
   ========================= */

function preencherSupervisores() {
  const supervisores = [...new Set(
    ESCOLAS
      .map(escola => escola.supervisor)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const select = $("#filtro-supervisor");

  supervisores.forEach(supervisor => {
    const opcao = document.createElement("option");
    opcao.value = supervisor;
    opcao.textContent = supervisor;
    select.appendChild(opcao);
  });
}

function renderizarEscolas() {
  const busca = $("#busca-escola").value.trim().toLowerCase();
  const supervisor = $("#filtro-supervisor").value;
  const ordenacao = $("#ordenar-escolas").value;

  let lista = ESCOLAS.filter(escola => {
    const texto = nomeCompleto(escola).toLowerCase();
    const correspondeBusca = !busca || texto.includes(busca);
    const correspondeSupervisor = !supervisor || escola.supervisor === supervisor;

    return correspondeBusca && correspondeSupervisor;
  });

  if (ordenacao === "nota") {
    lista.sort((a, b) => b.notaFinal - a.notaFinal);
  } else if (ordenacao === "presenca") {
    lista.sort((a, b) => presencaAtual(b).media - presencaAtual(a).media);
  } else if (ordenacao === "ifa") {
    lista.sort((a, b) => b.ifa - a.ifa);
  } else if (ordenacao === "nome") {
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  } else {
    lista.sort((a, b) => a.posicao - b.posicao);
  }

  $("#contador-escolas").textContent = `${lista.length} escola(s) exibida(s)`;

  const corpo = $("#tabela-escolas");
  corpo.innerHTML = "";

  lista.forEach(escola => {
    const atual = presencaAtual(escola);
    const situacao = situacaoIFA(escola);

    const linha = document.createElement("tr");

    linha.innerHTML = `
      <td>${escola.posicao}º</td>
      <td>
        <button
          type="button"
          class="escola-link"
          data-codigo="${escola.codigo}"
        >
          ${nomeCompleto(escola)}
        </button>
      </td>
      <td>${numero(escola.notaFinal)}</td>
      <td>${percentual(atual.media)}</td>
      <td>${percentual(escola.ifa / 100)}</td>
      <td>
        ${escola.supervisor || '<span class="sem-dado">Sem dado</span>'}
      </td>
      <td>
        <span class="${classeSelo(situacao)}">${situacao}</span>
      </td>
    `;

    corpo.appendChild(linha);
  });

  configurarLinksEscola();
}

function configurarFiltrosEscolas() {
  $("#busca-escola").addEventListener("input", renderizarEscolas);
  $("#filtro-supervisor").addEventListener("change", renderizarEscolas);
  $("#ordenar-escolas").addEventListener("change", renderizarEscolas);

  $("#limpar-filtros").addEventListener("click", () => {
    $("#busca-escola").value = "";
    $("#filtro-supervisor").value = "";
    $("#ordenar-escolas").value = "ranking";

    renderizarEscolas();
  });
}

/* =========================
   Plataformas
   ========================= */

function renderizarPlataformas() {
  const chave = $("#selecionar-plataforma").value;
  const busca = $("#busca-plataforma").value.trim().toLowerCase();
  const config = PLATAFORMAS[chave];

  $("#titulo-plataforma-selecionada").textContent = config.nome;

  $("#descricao-plataforma").textContent =
    "Escolas ordenadas pelo indicador da plataforma selecionada. Resultados ausentes são exibidos como “Sem dado”.";

  let lista = ESCOLAS.filter(escola => {
    if (!busca) return true;
    return nomeCompleto(escola).toLowerCase().includes(busca);
  });

  lista = lista
    .filter(escola => escola[config.campo] !== null && escola[config.campo] !== undefined)
    .sort((a, b) => b[config.campo] - a[config.campo]);

  const corpo = $("#tabela-plataforma");
  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = `
      <tr>
        <td colspan="3" class="sem-dado">
          Nenhum resultado disponível para esta plataforma.
        </td>
      </tr>
    `;

    return;
  }

  lista.forEach((escola, indice) => {
    const linha = document.createElement("tr");

    linha.innerHTML = `
      <td>${indice + 1}º</td>
      <td>${nomeCompleto(escola)}</td>
      <td>${numero(escola[config.campo], config.casas)}</td>
    `;

    corpo.appendChild(linha);
  });
}

function configurarPlataformas() {
  $("#selecionar-plataforma").addEventListener("change", renderizarPlataformas);
  $("#busca-plataforma").addEventListener("input", renderizarPlataformas);
}

/* =========================
   Aluno Presente / IFA
   ========================= */

function renderizarIFA() {
  const busca = $("#busca-ifa").value.trim().toLowerCase();
  const situacaoFiltro = $("#filtro-situacao-ifa").value;
  const ordenacao = $("#ordenar-ifa").value;

  let lista = ESCOLAS.filter(escola => {
    const situacao = situacaoIFA(escola);
    const correspondeBusca = !busca || nomeCompleto(escola).toLowerCase().includes(busca);
    const correspondeSituacao = !situacaoFiltro || situacao === situacaoFiltro;

    return correspondeBusca && correspondeSituacao;
  });

  if (ordenacao === "presenca") {
    lista.sort((a, b) => presencaAtual(b).media - presencaAtual(a).media);
  } else if (ordenacao === "ifa") {
    lista.sort((a, b) => b.ifa - a.ifa);
  } else if (ordenacao === "necessaria") {
    lista.sort((a, b) => {
      const valorA = mediaNecessaria(a);
      const valorB = mediaNecessaria(b);

      if (valorA === null) return 1;
      if (valorB === null) return -1;

      return valorA - valorB;
    });
  } else {
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  $("#contador-ifa").textContent = `${lista.length} escola(s) exibida(s)`;

  const corpo = $("#tabela-ifa");
  corpo.innerHTML = "";

  lista.forEach(escola => {
    const atual = presencaAtual(escola);
    const necessaria = mediaNecessaria(escola);
    const situacao = situacaoIFA(escola);

    const linha = document.createElement("tr");

    if (situacao === "Em acompanhamento" && necessaria >= 90) {
      linha.classList.add("destaque-atencao");
    }

    linha.innerHTML = `
      <td>${nomeCompleto(escola)}</td>
      <td>${percentual(atual.media)}</td>
      <td>${percentual(escola.ifa / 100)}</td>
      <td>${percentual(CONFIG.ifaURE / 100)}</td>
      <td>
        ${
          necessaria === null
            ? '<span class="sem-dado">Meta já atingida</span>'
            : percentual(necessaria)
        }
      </td>
      <td>
        <span class="${classeSelo(situacao)}">${situacao}</span>
      </td>
    `;

    corpo.appendChild(linha);
  });
}

function renderizarCalculadora() {
  const semana = Number($("#semana-calculadora").value);
  const container = $("#lancamento-grid");

  container.innerHTML = "";

  if (!lancamentos[semana]) {
    lancamentos[semana] = {};
  }

  ESCOLAS.forEach(escola => {
    const codigo = escola.codigo;
    const valorSalvo = lancamentos[semana][codigo] ?? "";

    const item = document.createElement("article");
    item.className = "lancamento";

    item.innerHTML = `
      <h4>${nomeCompleto(escola)}</h4>

      <label class="sr-only" for="input-${codigo}">
        Presença da semana ${semana} — ${nomeCompleto(escola)}
      </label>

      <input
        type="number"
        id="input-${codigo}"
        class="input-semana"
        min="0"
        max="100"
        step="0.01"
        value="${valorSalvo}"
        placeholder="Presença %"
      >
    `;

    container.appendChild(item);
  });
}

function calcularSemana() {
  const semana = Number($("#semana-calculadora").value);

  if (!lancamentos[semana]) {
    lancamentos[semana] = {};
  }

  ESCOLAS.forEach(escola => {
    const codigo = escola.codigo;
    const campo = $(`#input-${codigo}`);
    const valor = campo.value.trim();

    if (valor === "") {
      delete lancamentos[semana][codigo];
    } else {
      lancamentos[semana][codigo] = Number(valor);
    }
  });

  salvarLancamentos();

  renderizarCalculadora();
  renderizarIFA();
  renderizarVisaoGeral();

  alert(`Presenças da semana ${semana} calculadas e salvas neste navegador.`);
}

function exportarLancamentos() {
  const conteudo = JSON.stringify(lancamentos, null, 2);
  const blob = new Blob([conteudo], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "lancamentos-ifa-atualizados.json";
  link.click();

  URL.revokeObjectURL(link.href);
}

function restaurarBase() {
  const confirmacao = confirm(
    "Deseja restaurar a base original e apagar os lançamentos salvos neste navegador?"
  );

  if (!confirmacao) return;

  localStorage.removeItem(CHAVE_ARMAZENAMENTO);
  lancamentos = structuredClone(LANCAMENTOS_SEMANAIS);

  renderizarCalculadora();
  renderizarIFA();
  renderizarVisaoGeral();
}

function configurarIFA() {
  $("#busca-ifa").addEventListener("input", renderizarIFA);
  $("#filtro-situacao-ifa").addEventListener("change", renderizarIFA);
  $("#ordenar-ifa").addEventListener("change", renderizarIFA);

  $("#limpar-ifa").addEventListener("click", () => {
    $("#busca-ifa").value = "";
    $("#filtro-situacao-ifa").value = "";
    $("#ordenar-ifa").value = "presenca";

    renderizarIFA();
  });

  $("#semana-calculadora").addEventListener("change", renderizarCalculadora);
  $("#calcular-semana").addEventListener("click", calcularSemana);
  $("#exportar-lancamentos").addEventListener("click", exportarLancamentos);
  $("#restaurar-base").addEventListener("click", restaurarBase);
}

/* =========================
   Ficha da escola
   ========================= */

function abrirFicha(codigo) {
  const escola = buscarEscolaPorCodigo(codigo);

  if (!escola) return;

  const atual = presencaAtual(escola);
  const necessaria = mediaNecessaria(escola);
  const situacao = situacaoIFA(escola);

  $("#modal-titulo").textContent = nomeCompleto(escola);

  $("#modal-conteudo").innerHTML = `
    <section class="ficha-indicadores">
      <article class="ficha-indicador">
        <span>Ranking geral</span>
        <strong>${escola.posicao}º lugar</strong>
      </article>

      <article class="ficha-indicador">
        <span>Nota final</span>
        <strong>${numero(escola.notaFinal)}</strong>
      </article>

      <article class="ficha-indicador">
        <span>Presença consolidada</span>
        <strong>${percentual(atual.media)}</strong>
      </article>

      <article class="ficha-indicador">
        <span>IFA da escola</span>
        <strong>${percentual(escola.ifa / 100)}</strong>
      </article>

      <article class="ficha-indicador">
        <span>IFA da URE</span>
        <strong>${percentual(CONFIG.ifaURE / 100)}</strong>
      </article>

      <article class="ficha-indicador">
        <span>Média necessária</span>
        <strong>
          ${
            necessaria === null
              ? "Meta já atingida"
              : percentual(necessaria)
          }
        </strong>
      </article>
    </section>

    <p>
      <span class="${classeSelo(situacao)}">${situacao}</span>
    </p>

    <h3>Desempenho por plataforma</h3>

    <table>
      <caption class="sr-only">
        Resultados de ${nomeCompleto(escola)} por plataforma
      </caption>

      <thead>
        <tr>
          <th scope="col">Plataforma</th>
          <th scope="col">Resultado</th>
        </tr>
      </thead>

      <tbody>
        ${Object.entries(PLATAFORMAS).map(([chave, config]) => `
          <tr>
            <td>${config.nome}</td>
            <td>${numero(escola[config.campo], config.casas)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <h3>Supervisão</h3>
    <p>
      ${
        escola.supervisor ||
        '<span class="sem-dado">Supervisor(a) não informado(a) na base.</span>'
      }
    </p>

    <h3>Posição no ranking geral</h3>
    <p>
      Top 3: ${escola.top3} vez(es) •
      Top 5: ${escola.top5} vez(es) •
      Top 10: ${escola.top10} vez(es) •
      Posição média: ${numero(escola.posicaoMedia, 1)}º lugar
    </p>
  `;

  const modal = $("#modal-escola");
  modal.showModal();
}

function fecharFicha() {
  $("#modal-escola").close();
}

function configurarLinksEscola() {
  $$(".escola-link").forEach(botao => {
    botao.addEventListener("click", () => {
      abrirFicha(botao.dataset.codigo);
    });
  });
}

function configurarModal() {
  $("#fechar-modal").addEventListener("click", fecharFicha);

  $("#modal-escola").addEventListener("click", evento => {
    if (evento.target.id === "modal-escola") {
      fecharFicha();
    }
  });
}

/* =========================
   Inicialização
   ========================= */

function iniciar() {
  configurarNavegacao();
  preencherSupervisores();
  configurarFiltrosEscolas();
  configurarPlataformas();
  configurarIFA();
  configurarModal();

  renderizarVisaoGeral();
  renderizarEscolas();
  renderizarPlataformas();
  renderizarIFA();
  renderizarCalculadora();
}

document.addEventListener("DOMContentLoaded", iniciar);
