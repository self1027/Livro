import { MAPA_INFRACOES } from "/aif_helper/js/mapaInfracoes.js";
import { resolverBases } from "/aif_helper/js/resolverBases.js";

const opcoesDiv = document.getElementById("opcoes");
const resultadoDiv = document.getElementById("resultado");
const tipoPessoaSelect = document.getElementById("tipoPessoa");

const LEIS = {};
const tematicosSelecionados = new Set();
const extrasSelecionados = new Set();
const atividadesSelecionadas = new Set();

async function carregarLeis() {
  const arquivos = [
    "lei_10083_98.json",
    "decreto_12342_78.json",
    "lei_municipal_889_1980_andradina.json",
    "lei_municipal_2584_2010_andradina.json"
  ];

  for (const arq of arquivos) {
    const resp = await fetch(`/aif_helper/leis/${arq}`);
    const json = await resp.json();
    LEIS[json.id] = json;
  }
}

function renderOpcao(opcao, set) {
  const div = document.createElement("div");
  div.className = "opcao";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";

  checkbox.addEventListener("change", () => {
    checkbox.checked ? set.add(opcao) : set.delete(opcao);
    renderResultado();
  });

  div.appendChild(checkbox);
  div.append(" " + opcao.label);
  return div;
}

function renderResultado() {
  const tipo = MAPA_INFRACOES[tipoPessoaSelect.value];

  const bases = resolverBases({
    tipoPessoa: tipo,
    tematicos: [...tematicosSelecionados],
    atividades: [...atividadesSelecionadas],
    extras: [...extrasSelecionados]
  });

  const leisMap = new Map();
  bases.forEach(b => {
    if (!leisMap.has(b.lei)) leisMap.set(b.lei, []);
    leisMap.get(b.lei).push(b);
  });

  let html = "";

  leisMap.forEach((basesLei, leiId) => {
    const lei = LEIS[leiId];
    if (!lei) return;

    html += `
      <div class="card mb-3 shadow-sm">
        <div class="card-header bg-light">
          <strong>${lei.nome}</strong>
        </div>
        <div class="card-body">
    `;

    const artigosMap = new Map();

    basesLei.forEach(b => {
      const key = `${b.artigo}|${b.paragrafo || ""}`;

      const origemSet = new Set();
      if (b.origem) {
        if (b.origem instanceof Set) b.origem.forEach(o => origemSet.add(o));
        else if (Array.isArray(b.origem)) b.origem.forEach(o => origemSet.add(o));
        else origemSet.add(b.origem);
      }

      if (!artigosMap.has(key)) {
        artigosMap.set(key, {
          artigo: b.artigo,
          paragrafo: b.paragrafo,
          incisos: new Set(b.incisos || []),
          origem: origemSet
        });
      } else {
        const entry = artigosMap.get(key);
        (b.incisos || []).forEach(i => entry.incisos.add(i));
        origemSet.forEach(o => entry.origem.add(o));
      }
    });

    Array.from(artigosMap.values()).forEach(a => {
      const artigoData = lei.artigos[a.artigo];
      if (!artigoData) return;

      const artigoHtml = `
        <a href="javascript:void(0)"
           class="font-weight-bold text-decoration-underline"
           data-bs-toggle="popover"
           data-bs-trigger="hover focus"
           data-bs-html="true"
           data-bs-content="${artigoData.caput.replace(/"/g, '&quot;')}">
           ${artigoData.numero}
        </a>
      `;

      let paragrafoHtml = "";
      if (a.paragrafo) {
        const parData = artigoData.paragrafos?.[a.paragrafo];
        if (parData) {
          paragrafoHtml = `
            §
            <a href="javascript:void(0)"
               class="font-weight-normal text-decoration-underline"
               data-bs-toggle="popover"
               data-bs-trigger="hover focus"
               data-bs-html="true"
               data-bs-content="${parData.texto.replace(/"/g, '&quot;')}">
               ${parData.numero}º
            </a>
          `;
        }
      }

      let incisosHtml = "";
      if (a.incisos.size) {
        const incArray = Array.from(a.incisos).sort();
        const fonte = a.paragrafo
          ? artigoData.paragrafos[a.paragrafo].incisos
          : artigoData.incisos;

        incisosHtml =
          ", inciso " +
          incArray.map(i => `
            <a href="javascript:void(0)"
               class="font-weight-bold text-decoration-underline"
               data-bs-toggle="popover"
               data-bs-trigger="hover focus"
               data-bs-html="true"
               data-bs-content="${fonte[i].replace(/"/g, '&quot;')}">
               ${i.toUpperCase()}
            </a>
          `).join(" e ");
      }

      const origemHtml = a.origem.size
        ? `<div class="text-muted small ml-3">Origem: ${Array.from(a.origem).join(", ")}</div>`
        : "";

      html += `
        <div class="mb-2">
          Art. ${artigoHtml}
          ${paragrafoHtml}
          ${incisosHtml}
          ${origemHtml}
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  resultadoDiv.innerHTML = html;

  // Inicializa os popovers Bootstrap
  const popovers = document.querySelectorAll('[data-bs-toggle="popover"]');
  popovers.forEach(el => new bootstrap.Popover(el));
}

function montarOpcoes() {
  opcoesDiv.innerHTML = "";
  tematicosSelecionados.clear();
  extrasSelecionados.clear();
  atividadesSelecionadas.clear();
  resultadoDiv.innerHTML = "";

  const tipo = MAPA_INFRACOES[tipoPessoaSelect.value];

  // TEMÁTICOS
  const tematicoDiv = document.createElement("div");
  tematicoDiv.className = "grupo";
  tematicoDiv.innerHTML = "<strong>Temáticos</strong>";
  Object.values(tipo.TEMATICO).forEach(opcao => {
    tematicoDiv.appendChild(renderOpcao(opcao, tematicosSelecionados));
  });

  // ATIVIDADES
  const atividadeDiv = document.createElement("div");
  atividadeDiv.className = "grupo";
  atividadeDiv.innerHTML = "<strong>Atividades</strong>";
  Object.values(MAPA_INFRACOES.ATIVIDADE).forEach(opcao => {
    atividadeDiv.appendChild(renderOpcao(opcao, atividadesSelecionadas));
  });

  // EXTRAS
  const extrasDiv = document.createElement("div");
  extrasDiv.className = "grupo";
  extrasDiv.innerHTML = "<strong>Extras</strong>";
  Object.values(MAPA_INFRACOES.EXTRAS).forEach(opcao => {
    extrasDiv.appendChild(renderOpcao(opcao, extrasSelecionados));
  });

  opcoesDiv.appendChild(tematicoDiv);
  opcoesDiv.appendChild(atividadeDiv);
  opcoesDiv.appendChild(extrasDiv);
}

async function init() {
  await carregarLeis();
  montarOpcoes();
  tipoPessoaSelect.addEventListener("change", montarOpcoes);
}

init();
