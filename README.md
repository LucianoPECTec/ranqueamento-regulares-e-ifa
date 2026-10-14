📖 [Acesse a Wiki do projeto](https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO/wiki)

# 📊 Monitoramento Escolar — URE São José do Rio Preto

Painel web interno para acompanhamento do desempenho multissistema, da presença escolar e do IFA das escolas da Unidade Regional de Ensino (URE) de São José do Rio Preto.

O sistema foi desenvolvido para apoiar a gestão, a supervisão e o planejamento pedagógico, organizando informações já levantadas em uma visualização clara, filtrável e acessível.

---

## 📅 Período dos dados

- **Levantamento consolidado:** 1ª semana até a semana 37.
- **Projeção de IFA:** semanas 38 a 42.
- **Encerramento considerado:** segunda semana de novembro.
- **IFA de referência da URE:** 83,3%.

---

## 🎯 Finalidade

Este painel tem uso interno da URE São José do Rio Preto e organiza informações para:

- Acompanhar o desempenho das escolas nas plataformas educacionais.
- Visualizar a presença escolar consolidada.
- Monitorar o IFA de cada escola.
- Identificar escolas que ainda podem atingir a meta.
- Apoiar o planejamento de ações pedagógicas e de supervisão.

O painel não substitui os sistemas oficiais nem os resultados oficiais da Secretaria da Educação do Estado de São Paulo.

---

## 🧭 Áreas do painel

### Visão geral

Apresenta o panorama das 29 escolas monitoradas, com destaques de desempenho, presença e IFA.

### Escolas

Permite buscar escolas por nome ou código, filtrar por supervisor(a) e ordenar pelos principais indicadores.

Ao selecionar o nome da escola, abre a ficha individual com:

- Posição no ranking geral.
- Nota final.
- Presença consolidada.
- IFA da escola.
- IFA da URE.
- Média necessária para atingir o IFA.
- Resultados por plataforma.
- Supervisor(a), quando disponível.

### Plataformas

Exibe rankings específicos por plataforma:

- Tarefa SP
- Redação SP
- Leia SP
- SPeak
- Alura
- Matific — Anos Finais
- Khan Academy

### Aluno Presente / IFA

Apresenta a presença consolidada, o IFA de cada escola e a média necessária nas semanas 38 a 42 para atingir a meta.

### Sobre os dados

Explica o período analisado, os indicadores, os critérios de cálculo e as limitações da base.

---

## 🧮 Como o IFA é calculado

A presença consolidada é calculada a partir da soma dos percentuais semanais de “Aluno Presente”.

\[
\text{Média consolidada} =
\frac{\text{soma dos percentuais semanais}}{\text{número de semanas lançadas}}
\]

A média necessária nas semanas restantes é calculada assim:

\[
\text{Média necessária} =
\frac{(42 \times \text{IFA da escola}) - \text{soma atual}}{\text{semanas restantes}}
\]

---

## 🏷️ Situações do IFA

| Situação | Significado |
|---|---|
| **Dentro do IFA** | A escola já atingiu ou superou seu IFA até a semana 37. |
| **Em acompanhamento** | Ainda é possível atingir o IFA, desde que a escola alcance a média indicada nas semanas 38 a 42. |
| **Fora do alcance da meta** | Mesmo com 100% de presença nas semanas restantes, o IFA não será alcançado dentro do período considerado. |

Valores ausentes são exibidos como **“Sem dado”** e não são tratados como zero.

---

## 💻 Estrutura do repositório

```text
index.html    → estrutura e navegação do painel
styles.css    → aparência, cores, tabelas e responsividade
dados.js      → base das escolas, IFA, presença e plataformas
app.js        → cálculos, filtros, tabelas, calculadora e fichas
README.md     → este manual
```

Todos os arquivos devem permanecer na **raiz do repositório**.

---

## 🚀 Como publicar no GitHub Pages

1. Acesse o repositório no GitHub.
2. Clique em **Settings**.
3. No menu lateral, abra **Pages**.
4. Em **Build and deployment**, selecione:
   - **Source:** Deploy from a branch
   - **Branch:** main
   - **Folder:** / (root)
5. Clique em **Save**.
6. Aguarde alguns minutos.
7. O GitHub exibirá o link do site publicado.

O endereço normalmente terá este formato:

```text
[https://seu-usuario.github.io/nome-do-repositorio/](https://seu-usuario.github.io/nome-do-repositorio/)
```

---

## 🗓️ Como lançar a presença semanal

1. Abra a aba **Aluno Presente / IFA**.
2. Em **Calculadora semanal do IFA**, selecione a semana atual — por exemplo, semana 38.
3. Informe o percentual de presença de cada escola.
4. Clique em **Calcular e salvar semana**.
5. O painel recalcula automaticamente:
   - Presença consolidada.
   - Média necessária nas semanas restantes.
   - Situação da escola em relação ao IFA.

Os lançamentos ficam salvos temporariamente no navegador utilizado.

---

## ☁️ Como gravar a atualização para todos

O salvamento no navegador é útil para o lançamento rápido, mas não é compartilhado automaticamente entre computadores.

Para que todas as pessoas da URE vejam a mesma base atualizada:

1. Após lançar a semana, clique em **Exportar lançamentos**.
2. Abra o arquivo `lancamentos-ifa-atualizados.json` baixado.
3. Copie os valores das escolas.
4. No GitHub, abra o arquivo `dados.js`.
5. Clique no ícone de lápis para editar.
6. Localize este bloco:

```javascript
const LANCAMENTOS_SEMANAIS = {
  38: {},
  39: {},
  40: {},
  41: {},
  42: {}
};
```

7. Substitua pelos valores da semana. Exemplo:

```javascript
const LANCAMENTOS_SEMANAIS = {
  38: {
    "28769": 95,
    "27820": 88,
    "918337": 90
  },
  39: {},
  40: {},
  41: {},
  42: {}
};
```

8. Clique em **Commit changes**.
9. Aguarde alguns instantes.
10. O GitHub Pages atualiza automaticamente o painel para todos.

---

## 🔁 Como atualizar a base completa

Quando houver uma nova planilha consolidada, atualize o arquivo `dados.js` com:

- Posição no ranking geral.
- Nome e código da escola.
- Nota final.
- Resultados por plataforma.
- Presença consolidada.
- IFA da escola.
- Supervisor(a), quando disponível.

Mantenha o código da escola como identificador, pois ele é usado pela calculadora semanal.

---

## 👤 Créditos

**Desenvolvido por:** Luciano Julio da Silva  
**Função:** PEC — Desenvolvimento Curricular de Tecnologia  
**Unidade:** URE São José do Rio Preto  

Desenvolvimento com apoio de inteligência artificial: **Perplexity, 2026**.

---

## ⚠️ Observações

- Este painel é destinado ao uso interno da URE São José do Rio Preto.
- Os dados apresentados correspondem ao levantamento consolidado disponível na planilha de origem.
- As projeções de IFA são apoio à gestão e não substituem os resultados oficiais.
- Resultados ausentes não devem ser interpretados como zero.
