export function resolverBases({ tipoPessoa, tematicos = [], extras = [], atividades = [] }) {
  const bases = [];

  // Base obrigatória
  tipoPessoa.BASE.bases.forEach(b => bases.push({ ...b, origem: "BASE" }));

  // Atividades
  atividades.forEach(opcao => {
    opcao.bases.forEach(b => bases.push({ ...b, origem: opcao.label }));
  });

  // Temáticos
  tematicos.forEach(opcao => {
    opcao.bases.forEach(b => bases.push({ ...b, origem: opcao.label }));
  });

  // Extras
  extras.forEach(opcao => {
    opcao.bases.forEach(b => bases.push({ ...b, origem: opcao.label }));
  });

  // Agrupar por lei+artigo+parágrafo
  const map = new Map();

  bases.forEach(b => {
    const key = `${b.lei}|${b.artigo}|${b.paragrafo || ""}`;
    if (!map.has(key)) {
      map.set(key, {
        lei: b.lei,
        artigo: b.artigo,
        paragrafo: b.paragrafo,
        incisos: new Set(b.incisos || []),
        origem: new Set([b.origem])
      });
    } else {
      const entry = map.get(key);
      (b.incisos || []).forEach(i => entry.incisos.add(i));
      entry.origem.add(b.origem);
    }
  });

  let resultado = [...map.values()];

  // remover Art. 118 III se única seleção for Obstrução
  const totalSelecionados = [...tematicos, ...extras, ...atividades];
  const apenasObstrucao = totalSelecionados.length === 1 && totalSelecionados[0].label === "Obstrução de fiscalização";

  if (apenasObstrucao) {
    resultado = resultado.filter(
      b => !(b.lei === "lei_10083_98" && b.artigo === "art118" && b.incisos.has("iii"))
    );
  }

  return resultado;
}
