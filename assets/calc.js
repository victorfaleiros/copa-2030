// Motor de calculo da Comunidade Copa 2030.
// Mesma filosofia do planejamento de aposentadoria da plataforma:
// simulacao mes a mes com taxas do Focus por ano-calendario e busca binaria do aporte.

function taxaMensal(anual) { return Math.pow(1 + anual / 100, 1 / 12) - 1; }

function taxaDoAno(tabela, ano) {
  if (tabela[ano] != null) return tabela[ano];
  const anos = Object.keys(tabela).map(Number).sort((a, b) => a - b);
  if (ano < anos[0]) return tabela[anos[0]];
  return tabela[anos[anos.length - 1]];
}

// Lista dos meses entre hoje (exclusivo) e a data-alvo (inclusivo)
function mesesAteAlvo(hoje, alvo) {
  const meses = [];
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth() + 1; // 1-12
  while (ano < alvo.ano || (ano === alvo.ano && mes < alvo.mes)) {
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
    meses.push({ ano, mes });
  }
  return meses;
}

// totalHoje: soma dos gastos em R$ de hoje
// poupancaInicial: quanto ja tem guardado
// Retorna aporte mensal para chegar ao total corrigido pela inflacao ate jun/2029, rendendo 100% do CDI.
function calcularPlano({ totalHoje, poupancaInicial, premissas, hoje }) {
  const agora = hoje || new Date();
  const meses = mesesAteAlvo(agora, premissas.dataAlvo);
  const n = meses.length;

  // Corrige o custo da viagem pela inflacao (Focus IPCA) ate a data-alvo
  let fatorInflacao = 1;
  for (const m of meses) fatorInflacao *= 1 + taxaMensal(taxaDoAno(premissas.ipca, m.ano));
  const totalCorrigido = totalHoje * fatorInflacao;

  // Simula a poupanca rendendo 100% do CDI, com aporte no fim de cada mes
  function simular(aporte) {
    let p = poupancaInicial;
    for (const m of meses) p = p * (1 + taxaMensal(taxaDoAno(premissas.cdi, m.ano))) + aporte;
    return p;
  }

  let aporte = 0;
  if (n > 0 && simular(0) < totalCorrigido) {
    let lo = 0, hi = Math.max(totalCorrigido / n * 2, 100);
    while (simular(hi) < totalCorrigido) hi *= 2;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (simular(mid) >= totalCorrigido) hi = mid; else lo = mid;
    }
    aporte = Math.ceil(hi);
  }

  const totalAportado = aporte * n;
  const saldoFinal = simular(aporte);
  const rendimento = Math.max(0, saldoFinal - poupancaInicial - totalAportado);

  return {
    meses: n,
    dataAlvo: premissas.dataAlvo,
    totalHoje,
    totalCorrigido: Math.round(totalCorrigido),
    aporte,
    totalAportado: Math.round(totalAportado),
    rendimento: Math.round(rendimento),
    saldoFinal: Math.round(saldoFinal),
    jaTem: poupancaInicial,
  };
}

if (typeof module !== 'undefined') module.exports = { calcularPlano, mesesAteAlvo, taxaMensal };
