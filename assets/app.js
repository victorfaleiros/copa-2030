// App da Comunidade Copa 2030: dashboard com orcamento, plano de aportes e caixinha.
// Tudo recalcula ao vivo; os botoes "Salvar" persistem no Supabase.

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('pt-BR');
const MESES_NOME = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const $ = (id) => document.getElementById(id);
function mostrar(tela) {
  ['tela-auth', 'tela-dash'].forEach(t => $(t).classList.toggle('oculto', t !== tela));
  $('topbar-usuario').classList.toggle('oculto', tela !== 'tela-dash');
}

// ---------- estado ----------
let usuarioAtual = null;
let planoAtual = null;      // linha do banco (ou null)
let aportesAtuais = {};     // copia de trabalho editada na tabela {YYYY-MM: valor}

function mesAtual() { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() + 1 }; }
function cmpMes(a, b) { return (a.ano - b.ano) * 12 + (a.mes - b.mes); }
function inicioDoPlano() {
  const i = planoAtual && planoAtual.detalhes && planoAtual.detalhes.inicio;
  if (i) { const [a, m] = i.split('-').map(Number); return { ano: a, mes: m }; }
  return mesAtual();
}

// ---------- campos de dinheiro ----------
function lerValor(input) {
  const digitos = String(input.value).replace(/\D/g, '');
  return digitos ? parseInt(digitos, 10) : 0;
}
function aplicarValor(input, v) { input.value = v ? fmtNum.format(v) : ''; }

// ---------- pessoas ----------
const selPessoas = $('pessoas');
for (let i = 1; i <= 10; i++) {
  const o = document.createElement('option');
  o.value = i;
  o.textContent = i === 1 ? '1 pessoa (só eu)' : i + ' pessoas';
  selPessoas.appendChild(o);
}
function pessoas() { return parseInt(selPessoas.value, 10) || 1; }

// ---------- monta os campos de gasto ----------
const lista = $('lista-gastos');
for (const cat of CATEGORIAS) {
  const div = document.createElement('div');
  div.className = 'campo campo-gasto' + (cat.meia ? ' meia' : '');
  let html = `<label for="gasto-${cat.id}">${cat.nome}</label><span class="dica">${cat.dica}</span>`;
  if (cat.tipo === 'jogos') {
    html += `<div class="qtd-linha"><span>Jogos:</span><select id="qtd-${cat.id}">` +
      Array.from({ length: cat.qtdMax - cat.qtdMin + 1 }, (_, i) => {
        const q = cat.qtdMin + i;
        return `<option value="${q}" ${q === cat.qtdPadrao ? 'selected' : ''}>${q}</option>`;
      }).join('') + '</select></div>';
  }
  html += '<div class="chips">' + cat.ref.map((v, i) =>
    `<button type="button" class="chip" data-cat="${cat.id}" data-valor="${v}">${NIVEIS[i]} <b>${fmtBRL.format(v)}</b></button>`
  ).join('') + '</div>';
  html += `<div class="prefixo"><span>R$</span><input id="gasto-${cat.id}" type="text" inputmode="numeric" placeholder="0"></div>`;
  div.innerHTML = html;
  lista.appendChild(div);
}

// clique nas sugestoes: multiplica por pessoas (e pela quantidade de jogos)
lista.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const cat = CATEGORIAS.find(c => c.id === chip.dataset.cat);
  const base = parseInt(chip.dataset.valor, 10);
  const qtd = cat.tipo === 'jogos' ? parseInt($(`qtd-${cat.id}`).value, 10) : 1;
  aplicarValor($(`gasto-${cat.id}`), base * qtd * pessoas());
  atualizarCalculos();
});

// qualquer mudanca no orcamento recalcula tudo ao vivo
$('form-plano').addEventListener('input', (e) => {
  if (e.target.matches('input[inputmode="numeric"]')) aplicarValor(e.target, lerValor(e.target));
  atualizarCalculos();
});
$('form-plano').addEventListener('change', atualizarCalculos); // selects (pessoas e jogos)

function somarGastos() {
  let total = 0;
  const gastos = {};
  for (const cat of CATEGORIAS) {
    const v = lerValor($(`gasto-${cat.id}`));
    gastos[cat.id] = v;
    total += v;
  }
  return { total, gastos };
}

// ---------- abas ----------
$('aba-cadastro').addEventListener('click', () => alternarAba(true));
$('aba-login').addEventListener('click', () => alternarAba(false));
function alternarAba(cadastro) {
  $('aba-cadastro').classList.toggle('ativa', cadastro);
  $('aba-login').classList.toggle('ativa', !cadastro);
  $('form-cadastro').classList.toggle('oculto', !cadastro);
  $('form-login').classList.toggle('oculto', cadastro);
}

function avisar(id, texto, ok) {
  const el = $(id);
  el.textContent = texto;
  el.className = 'mensagem ' + (ok ? 'ok' : 'erro');
  if (ok) setTimeout(() => { el.textContent = ''; }, 4000);
}

// ---------- cadastro e login ----------
$('form-cadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const botao = e.target.querySelector('button[type="submit"]');
  botao.disabled = true;
  const { data, error } = await supa.auth.signUp({
    email: $('cad-email').value.trim(),
    password: $('cad-senha').value,
    options: { data: {
      nome: $('cad-nome').value.trim(),
      whatsapp: $('cad-whatsapp').value.trim(),
      aceita_contato: $('cad-contato').checked,
    } },
  });
  botao.disabled = false;
  if (error) {
    const msg = /already registered/i.test(error.message)
      ? 'Esse e-mail já tem conta. Use a aba "Já tenho conta".'
      : 'Não foi possível criar a conta agora. Confira os dados e tente de novo.';
    return avisar('msg-cadastro', msg, false);
  }
  if (!data.session) {
    return avisar('msg-cadastro', 'Conta criada! Enviamos um link de confirmação para o seu e-mail. Clique nele e depois entre pela aba "Já tenho conta".', true);
  }
  entrarNoPainel(data.session.user);
});

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const botao = e.target.querySelector('button[type="submit"]');
  botao.disabled = true;
  const { data, error } = await supa.auth.signInWithPassword({
    email: $('log-email').value.trim(),
    password: $('log-senha').value,
  });
  botao.disabled = false;
  if (error) return avisar('msg-login', 'E-mail ou senha incorretos. Tente de novo.', false);
  entrarNoPainel(data.session.user);
});

$('btn-sair').addEventListener('click', async () => {
  await supa.auth.signOut();
  usuarioAtual = null; planoAtual = null; aportesAtuais = {};
  mostrar('tela-auth');
});

// ---------- entrada no painel ----------
async function entrarNoPainel(user) {
  usuarioAtual = user;
  const nome = ((user.user_metadata && user.user_metadata.nome) || '').split(' ')[0];
  $('topbar-nome').textContent = nome ? `Olá, ${nome}` : '';
  $('dash-titulo').textContent = nome ? `Fala, ${nome}! Seu plano para a Copa de 2030` : 'Seu plano para a Copa de 2030';

  const { data: plano } = await supa.from('copa_planos').select('*').eq('user_id', user.id).maybeSingle();
  planoAtual = plano || null;
  aportesAtuais = (plano && { ...plano.aportes }) || {};

  if (plano) {
    const gastos = { ...(plano.gastos || {}) };
    for (const [antigo, novo] of Object.entries(MIGRACAO_GASTOS)) {
      if (gastos[antigo] != null && gastos[novo] == null) gastos[novo] = gastos[antigo];
    }
    for (const cat of CATEGORIAS) {
      aplicarValor($(`gasto-${cat.id}`), gastos[cat.id] || 0);
      if (cat.tipo === 'jogos') {
        const q = plano.detalhes && plano.detalhes['qtd_' + cat.id];
        if (q != null) $(`qtd-${cat.id}`).value = q;
      }
    }
    if (plano.pessoas) selPessoas.value = plano.pessoas;
    aplicarValor($('poupanca'), Number(plano.poupanca_inicial) || 0);
  }
  $('res-premissas').textContent = `Premissas: rendimento de 100% do CDI e inflação pelo IPCA, com as projeções do Boletim Focus de ${PREMISSAS.boletim.split('-').reverse().join('/')} (Banco Central). Sugestões de gasto são estimativas em valores de hoje, sem garantia de rentabilidade.`;
  montarLegenda();
  montarTabela();
  atualizarCalculos();
  mostrar('tela-dash');
}

// ---------- calculo central (roda a cada mudanca) ----------
function calcularTudo() {
  const { total, gastos } = somarGastos();
  const poupanca = lerValor($('poupanca'));
  const ini = inicioDoPlano();
  const agora = mesAtual();
  const r = calcularPlano({ totalHoje: total, poupancaInicial: poupanca, premissas: PREMISSAS, inicio: ini });
  const plan = serieSaldo({ poupancaInicial: poupanca, premissas: PREMISSAS, inicio: ini, aportePorMes: () => r.aporte });
  const real = serieSaldo({ poupancaInicial: poupanca, premissas: PREMISSAS, inicio: ini, aportePorMes: (k) => Number(aportesAtuais[k]) || 0 });
  const idxAtual = Math.max(0, Math.min(cmpMes(agora, ini), plan.length - 1));
  // ate onde desenhar a linha da caixinha: hoje ou o ultimo mes futuro ja preenchido
  let idxUltimo = idxAtual;
  for (const k of Object.keys(aportesAtuais)) {
    if (!Number(aportesAtuais[k])) continue;
    const [a, m] = k.split('-').map(Number);
    const idx = cmpMes({ ano: a, mes: m }, ini);
    if (idx > idxUltimo && idx <= plan.length - 1) idxUltimo = idx;
  }
  return { r, gastos, plan, real, idxAtual, idxUltimo, ini, agora };
}

function atualizarCalculos() {
  const c = calcularTudo();
  // KPIs
  $('kpi-aporte').textContent = fmtBRL.format(c.r.aporte);
  $('kpi-hoje').textContent = fmtBRL.format(c.r.totalHoje);
  $('kpi-pessoas').textContent = pessoas() === 1 ? 'para 1 pessoa' : `para ${pessoas()} pessoas`;
  $('kpi-corrigido').textContent = fmtBRL.format(c.r.totalCorrigido);
  const tem = c.real[c.idxAtual].saldo, deveria = c.plan[c.idxAtual].saldo;
  $('kpi-caixinha').textContent = fmtBRL.format(tem);
  const dif = tem - deveria;
  const pill = $('kpi-status');
  if (Math.abs(dif) < Math.max(50, c.r.aporte * 0.1)) { pill.textContent = 'No ritmo'; pill.className = 'pill ok'; }
  else if (dif > 0) { pill.textContent = 'Adiantado ' + fmtBRL.format(dif); pill.className = 'pill ok'; }
  else { pill.textContent = 'Faltando ' + fmtBRL.format(-dif); pill.className = 'pill atencao'; }
  // total do orcamento e resumo
  $('total-viagem').textContent = fmtBRL.format(c.r.totalHoje);
  $('res-ja-tem').textContent = fmtBRL.format(c.r.jaTem);
  $('res-aportado').textContent = fmtBRL.format(c.r.totalAportado);
  $('res-rendimento').textContent = '+ ' + fmtBRL.format(c.r.rendimento);
  $('res-meses').textContent = c.r.meses - c.idxAtual;
  // grafico e colunas calculadas da tabela
  desenharGrafico(c.plan, c.real, c.idxAtual, c.idxUltimo);
  atualizarTabelaCalculada(c);
}

// ---------- salvar plano ----------
$('form-plano').addEventListener('submit', async (e) => {
  e.preventDefault();
  const c = calcularTudo();
  if (c.r.totalHoje <= 0) return avisar('msg-plano', 'Preencha ao menos um gasto para salvar o seu plano.', false);
  const botao = e.target.querySelector('button[type="submit"]');
  botao.disabled = true;
  const meta = usuarioAtual.user_metadata || {};
  const detalhes = { inicio: c.ini.ano + '-' + String(c.ini.mes).padStart(2, '0') };
  for (const cat of CATEGORIAS) if (cat.tipo === 'jogos') detalhes['qtd_' + cat.id] = parseInt($(`qtd-${cat.id}`).value, 10);
  const linha = {
    user_id: usuarioAtual.id,
    nome: meta.nome || '',
    email: usuarioAtual.email,
    whatsapp: meta.whatsapp || '',
    aceita_contato: meta.aceita_contato !== false,
    pessoas: pessoas(),
    poupanca_inicial: c.r.jaTem,
    gastos: c.gastos,
    total_hoje: c.r.totalHoje,
    total_corrigido: c.r.totalCorrigido,
    aporte_mensal: c.r.aporte,
    meses: c.r.meses,
    detalhes,
    aportes: aportesAtuais,
    premissas: { boletim: PREMISSAS.boletim, cdi: PREMISSAS.cdi, ipca: PREMISSAS.ipca, dataAlvo: PREMISSAS.dataAlvo },
  };
  const { data, error } = await supa.from('copa_planos').upsert(linha, { onConflict: 'user_id' }).select().maybeSingle();
  botao.disabled = false;
  if (error) return avisar('msg-plano', 'Não conseguimos salvar agora. Tente de novo em instantes.', false);
  planoAtual = data || { ...linha };
  avisar('msg-plano', 'Plano salvo!', true);
});

// ---------- tabela de aportes ----------
function montarTabela() {
  const ini = inicioDoPlano();
  const agora = mesAtual();
  const meses = mesesEntre(ini, PREMISSAS.dataAlvo);
  const corpo = $('linhas-aportes');
  corpo.textContent = '';
  $('aportes-vazio').style.display = 'none';
  const passados = meses.filter(m => cmpMes(m, agora) <= 0).length;

  meses.forEach((m, i) => {
    const k = chaveMes(m);
    const passado = cmpMes(m, agora) <= 0;
    const tr = document.createElement('tr');
    tr.dataset.mes = k;
    if (passado && i === passados - 1) tr.className = 'mes-atual';
    else if (!passado) tr.className = 'mes-futuro';

    const tdMes = document.createElement('td');
    tdMes.textContent = `${MESES_ABREV[m.mes - 1]}/${m.ano}`;
    const tdPlano = document.createElement('td');
    tdPlano.className = 'num plano-copiavel';
    tdPlano.title = 'Copiar para "Meu aporte"';
    const tdMeu = document.createElement('td');
    tdMeu.className = 'num';
    const input = document.createElement('input');
    input.className = 'aporte-input';
    input.type = 'text';
    input.inputMode = 'numeric';
    input.placeholder = '0';
    input.dataset.valor = k;
    if (aportesAtuais[k] != null) aplicarValor(input, Number(aportesAtuais[k]));
    input.addEventListener('input', () => {
      aplicarValor(input, lerValor(input));
      const v = lerValor(input);
      if (input.value === '') delete aportesAtuais[k]; else aportesAtuais[k] = v;
      atualizarCalculos();
    });
    tdMeu.appendChild(input);
    tdPlano.addEventListener('click', () => {
      aplicarValor(input, planoDaVez);
      aportesAtuais[k] = planoDaVez;
      atualizarCalculos();
    });
    const tdSaldoPlan = document.createElement('td');
    tdSaldoPlan.className = 'num saldo-plan';
    const tdSaldoReal = document.createElement('td');
    tdSaldoReal.className = 'num saldo-real';
    tdMeu.classList.add('div-grupo');

    // ordem: Mes | Planejado (aporte, saldo) | Realizado (aporte, saldo no fim do mes)
    tr.append(tdMes, tdPlano, tdSaldoPlan, tdMeu, tdSaldoReal);
    corpo.appendChild(tr);
  });
}

let planoDaVez = 0; // aporte planejado vigente (para o clique de copiar)

function atualizarTabelaCalculada(c) {
  planoDaVez = c.r.aporte;
  const linhas = $('linhas-aportes').children;
  for (let i = 0; i < linhas.length; i++) {
    const tr = linhas[i];
    const tds = tr.children; // [0] mes | [1] aporte plano | [2] saldo plano | [3] meu aporte | [4] saldo real
    tds[1].textContent = fmtBRL.format(c.r.aporte);
    tds[2].textContent = fmtBRL.format(Math.round(c.plan[i + 1].saldo));
    const mostrar = i + 1 <= c.idxUltimo;
    tds[4].textContent = mostrar ? fmtBRL.format(Math.round(c.real[i + 1].saldo)) : '—';
    tds[4].classList.toggle('sem-aporte', !mostrar);
  }
}

$('btn-salvar-aportes').addEventListener('click', async () => {
  if (!planoAtual) return avisar('msg-caixinha', 'Salve o seu plano primeiro, aí os aportes ficam guardados juntos.', false);
  const botao = $('btn-salvar-aportes');
  botao.disabled = true;
  const { error } = await supa.from('copa_planos').update({ aportes: aportesAtuais }).eq('user_id', usuarioAtual.id);
  botao.disabled = false;
  if (error) return avisar('msg-caixinha', 'Não conseguimos salvar agora. Tente de novo em instantes.', false);
  planoAtual.aportes = { ...aportesAtuais };
  avisar('msg-caixinha', 'Aportes salvos!', true);
});

// ---------- grafico (SVG, sem bibliotecas) ----------
const COR_PLAN = '#2a78d6', COR_REAL = '#17724a';

function montarLegenda() {
  const lg = $('gr-legenda');
  lg.textContent = '';
  [['Planejado', COR_PLAN], ['Sua caixinha', COR_REAL]].forEach(([nome, cor]) => {
    const item = document.createElement('span');
    item.className = 'lg-item';
    const chave = document.createElement('span');
    chave.className = 'lg-chave';
    chave.style.background = cor;
    item.appendChild(chave);
    item.appendChild(document.createTextNode(nome));
    lg.appendChild(item);
  });
}

function nivelBom(max) {
  const bruto = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 2, 2.5, 5, 10]) if (bruto <= m * p) return m * p;
  return 10 * p;
}
function fmtMil(v) {
  if (v === 0) return '0';
  if (v < 1000) return fmtNum.format(v);
  return fmtNum.format(Math.round(v / 100) / 10).replace(/,0$/, '') + ' mil';
}

function desenharGrafico(plan, real, idxAtual, idxUltimo) {
  if (idxUltimo == null) idxUltimo = idxAtual;
  const svg = $('grafico');
  const W = 640, H = 330, ml = 58, mr = 16, mt = 16, mb = 32;
  const iw = W - ml - mr, ih = H - mt - mb;
  const n = plan.length;
  const ymax = Math.max(plan[n - 1].saldo, real[idxUltimo].saldo, 1);
  const passo = nivelBom(ymax);
  const ytop = Math.ceil(ymax / passo) * passo;
  const X = (i) => ml + (i / (n - 1)) * iw;
  const Y = (v) => mt + ih - (v / ytop) * ih;

  let s = `<defs><linearGradient id="gr-wash" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${COR_REAL}" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="${COR_REAL}" stop-opacity="0.02"/>
  </linearGradient></defs>`;
  for (let v = 0; v <= ytop; v += passo) {
    s += `<line x1="${ml}" y1="${Y(v)}" x2="${W - mr}" y2="${Y(v)}" stroke="${v === 0 ? '#cfd8d0' : '#e8ece7'}" stroke-width="1"/>`;
    s += `<text x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end" class="gr-tick">${fmtMil(v)}</text>`;
  }
  for (let i = 0; i < n; i += 6) {
    const p = plan[i];
    s += `<text x="${X(i)}" y="${H - 9}" text-anchor="middle" class="gr-tick">${MESES_ABREV[p.mes - 1]}/${String(p.ano).slice(2)}</text>`;
  }
  const caminho = (serie, ate) => serie.slice(0, ate + 1).map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.saldo).toFixed(1)}`).join('');
  s += `<path d="${caminho(real, idxUltimo)}L${X(idxUltimo)},${Y(0)}L${X(0)},${Y(0)}Z" fill="url(#gr-wash)"/>`;
  s += `<path d="${caminho(plan, n - 1)}" fill="none" stroke="${COR_PLAN}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += `<path d="${caminho(real, idxUltimo)}" fill="none" stroke="${COR_REAL}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += `<circle cx="${X(idxUltimo)}" cy="${Y(real[idxUltimo].saldo)}" r="6.5" fill="#ffffff"/>`;
  s += `<circle cx="${X(idxUltimo)}" cy="${Y(real[idxUltimo].saldo)}" r="4.5" fill="${COR_REAL}"/>`;
  s += `<text x="${W - mr}" y="${Y(plan[n - 1].saldo) - 8}" text-anchor="end" class="gr-rotulo">meta ${fmtBRL.format(plan[n - 1].saldo)}</text>`;
  const lx = Math.min(X(idxUltimo) + 9, W - mr - 70);
  s += `<text x="${lx}" y="${Y(real[idxUltimo].saldo) + (idxUltimo < 3 ? -12 : 21)}" class="gr-rotulo">${fmtBRL.format(real[idxUltimo].saldo)}</text>`;
  s += `<line id="gr-mira" x1="0" y1="${mt}" x2="0" y2="${mt + ih}" stroke="#7c8a80" stroke-width="1" opacity="0"/>`;
  s += `<rect id="gr-hit" x="${ml}" y="${mt}" width="${iw}" height="${ih}" fill="transparent"/>`;
  svg.innerHTML = s;

  const hit = svg.querySelector('#gr-hit');
  const mira = svg.querySelector('#gr-mira');
  const tt = $('gr-tooltip');
  function moverTooltip(evt) {
    const box = svg.getBoundingClientRect();
    const px = (evt.clientX - box.left) * (W / box.width);
    const i = Math.max(0, Math.min(n - 1, Math.round((px - ml) / iw * (n - 1))));
    mira.setAttribute('x1', X(i)); mira.setAttribute('x2', X(i));
    mira.setAttribute('opacity', '1');
    tt.textContent = '';
    const t = document.createElement('div');
    t.className = 'tt-titulo';
    t.textContent = `${MESES_NOME[plan[i].mes - 1]}/${plan[i].ano}`;
    tt.appendChild(t);
    const linhas = [[fmtBRL.format(Math.round(plan[i].saldo)), 'planejado', COR_PLAN]];
    if (i <= idxUltimo) linhas.unshift([fmtBRL.format(Math.round(real[i].saldo)), 'sua caixinha', COR_REAL]);
    for (const [valor, nome, cor] of linhas) {
      const l = document.createElement('div');
      l.className = 'tt-linha';
      const chave = document.createElement('span');
      chave.className = 'lg-chave';
      chave.style.background = cor;
      const v = document.createElement('b');
      v.textContent = valor;
      l.appendChild(chave); l.appendChild(v); l.appendChild(document.createTextNode(' ' + nome));
      tt.appendChild(l);
    }
    tt.classList.remove('oculto');
    const envolve = $('gr-envolve').getBoundingClientRect();
    const ttw = tt.offsetWidth;
    let esq = evt.clientX - envolve.left + 12;
    if (esq + ttw > envolve.width - 4) esq = evt.clientX - envolve.left - ttw - 12;
    tt.style.left = Math.max(4, esq) + 'px';
    tt.style.top = '14px';
  }
  hit.addEventListener('pointermove', moverTooltip);
  hit.addEventListener('pointerleave', () => { tt.classList.add('oculto'); mira.setAttribute('opacity', '0'); });
}

// ---------- estado inicial ----------
(async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (session) entrarNoPainel(session.user);
  else mostrar('tela-auth');
})();
