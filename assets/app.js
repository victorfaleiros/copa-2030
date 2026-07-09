// App da Comunidade Copa 2030: login, orcamento com referencias, plano de aportes e caixinha.

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('pt-BR');
const MESES_NOME = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const $ = (id) => document.getElementById(id);
const telas = ['tela-auth', 'tela-plano', 'tela-resultado', 'tela-caixinha'];
function mostrar(tela) { telas.forEach(t => $(t).classList.toggle('oculto', t !== tela)); }

// ---------- campos de dinheiro ----------
function lerValor(input) {
  const digitos = String(input.value).replace(/\D/g, '');
  return digitos ? parseInt(digitos, 10) : 0;
}
function aplicarValor(input, v) { input.value = v ? fmtNum.format(v) : ''; }
function mascararDinheiro(input) {
  input.addEventListener('input', () => { aplicarValor(input, lerValor(input)); atualizarTotal(); });
}

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
function chipsHTML(cat, valores, grupo) {
  return '<div class="chips">' + (grupo ? `<span class="chips-rotulo">${grupo}</span>` : '') +
    valores.map((v, i) =>
      `<button type="button" class="chip" data-cat="${cat.id}" data-valor="${v}">${NIVEIS[i]} <b>${fmtBRL.format(v)}</b></button>`
    ).join('') + '</div>';
}

const lista = $('lista-gastos');
for (const cat of CATEGORIAS) {
  const div = document.createElement('div');
  div.className = 'campo campo-gasto';
  let html = `<label for="gasto-${cat.id}">${cat.nome} <span class="dica">${cat.dica}</span></label>`;
  if (cat.tipo === 'jogos') {
    html += `<div class="qtd-linha"><span>Quantos jogos?</span><select id="qtd-${cat.id}">` +
      Array.from({ length: cat.qtdMax - cat.qtdMin + 1 }, (_, i) => {
        const q = cat.qtdMin + i;
        return `<option value="${q}" ${q === cat.qtdPadrao ? 'selected' : ''}>${q === 0 ? 'nenhum' : q + (q === 1 ? ' jogo' : ' jogos')}</option>`;
      }).join('') + '</select></div>';
    html += chipsHTML(cat, cat.refBrasil, '🇧🇷 Jogo do Brasil');
    html += chipsHTML(cat, cat.refAleatorio, '🌍 Jogo aleatório');
    html += '<p class="chips-nota">valores por jogo, por pessoa</p>';
  } else {
    html += chipsHTML(cat, cat.ref, '');
    html += '<p class="chips-nota">valores por pessoa</p>';
  }
  html += `<div class="prefixo"><span>R$</span><input id="gasto-${cat.id}" type="text" inputmode="numeric" placeholder="0"></div>`;
  div.innerHTML = html;
  lista.appendChild(div);
}
document.querySelectorAll('#form-plano input[inputmode="numeric"]').forEach(mascararDinheiro);

// clique nas sugestoes: multiplica por pessoas (e por jogos, quando for ingresso)
lista.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const cat = CATEGORIAS.find(c => c.id === chip.dataset.cat);
  const base = parseInt(chip.dataset.valor, 10);
  const qtd = cat.tipo === 'jogos' ? parseInt($(`qtd-${cat.id}`).value, 10) : 1;
  aplicarValor($(`gasto-${cat.id}`), base * qtd * pessoas());
  atualizarTotal();
});

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
function atualizarTotal() { $('total-viagem').textContent = fmtBRL.format(somarGastos().total); }

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
}

// ---------- cadastro ----------
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
  entrarNoPlano(data.session.user);
});

// ---------- login ----------
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
  entrarNoPlano(data.session.user);
});

// ---------- sessao ----------
let usuarioAtual = null;
let planoAtual = null;

function mesAtual() { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() + 1 }; }
function inicioDoPlano() {
  const i = planoAtual && planoAtual.detalhes && planoAtual.detalhes.inicio;
  if (i) { const [a, m] = i.split('-').map(Number); return { ano: a, mes: m }; }
  return mesAtual();
}

async function entrarNoPlano(user) {
  usuarioAtual = user;
  const nome = (user.user_metadata && user.user_metadata.nome) || '';
  $('saudacao').textContent = nome ? `${nome.split(' ')[0]}, monte o orçamento da sua viagem` : 'Monte o orçamento da sua viagem';

  const { data: plano } = await supa.from('copa_planos').select('*').eq('user_id', user.id).maybeSingle();
  planoAtual = plano || null;
  if (plano) {
    for (const cat of CATEGORIAS) {
      aplicarValor($(`gasto-${cat.id}`), (plano.gastos && plano.gastos[cat.id]) || 0);
      if (cat.tipo === 'jogos') {
        const q = plano.detalhes && plano.detalhes['qtd_' + cat.id];
        if (q != null) $(`qtd-${cat.id}`).value = q;
      }
    }
    if (plano.pessoas) selPessoas.value = plano.pessoas;
    aplicarValor($('poupanca'), Number(plano.poupanca_inicial) || 0);
    atualizarTotal();
    mostrarResultado(recalcular());
    return;
  }
  atualizarTotal();
  mostrar('tela-plano');
}

async function sair() {
  await supa.auth.signOut();
  usuarioAtual = null;
  planoAtual = null;
  mostrar('tela-auth');
}
['sair-1', 'sair-2', 'sair-3'].forEach(id => $(id).addEventListener('click', sair));

// ---------- calculo e gravacao ----------
function recalcular() {
  const { total, gastos } = somarGastos();
  const poupanca = lerValor($('poupanca'));
  const r = calcularPlano({ totalHoje: total, poupancaInicial: poupanca, premissas: PREMISSAS, inicio: inicioDoPlano() });
  return { ...r, gastos };
}

$('form-plano').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = recalcular();
  if (r.totalHoje <= 0) return avisar('msg-plano', 'Preencha ao menos um gasto para calcular o seu plano.', false);

  const botao = e.target.querySelector('button[type="submit"]');
  botao.disabled = true;
  const meta = usuarioAtual.user_metadata || {};
  const ini = inicioDoPlano();
  const detalhes = {
    inicio: ini.ano + '-' + String(ini.mes).padStart(2, '0'),
    qtd_jogos_grupo: parseInt($('qtd-jogos_grupo').value, 10),
    qtd_jogos_mata: parseInt($('qtd-jogos_mata').value, 10),
  };
  const linha = {
    user_id: usuarioAtual.id,
    nome: meta.nome || '',
    email: usuarioAtual.email,
    whatsapp: meta.whatsapp || '',
    aceita_contato: meta.aceita_contato !== false,
    pessoas: pessoas(),
    poupanca_inicial: r.jaTem,
    gastos: r.gastos,
    total_hoje: r.totalHoje,
    total_corrigido: r.totalCorrigido,
    aporte_mensal: r.aporte,
    meses: r.meses,
    detalhes,
    aportes: (planoAtual && planoAtual.aportes) || {},
    premissas: { boletim: PREMISSAS.boletim, cdi: PREMISSAS.cdi, ipca: PREMISSAS.ipca, dataAlvo: PREMISSAS.dataAlvo },
  };
  const { data, error } = await supa.from('copa_planos').upsert(linha, { onConflict: 'user_id' }).select().maybeSingle();
  botao.disabled = false;
  if (error) return avisar('msg-plano', 'Não conseguimos salvar agora. Tente de novo em instantes.', false);
  planoAtual = data || { ...linha };
  mostrarResultado(r);
});

function mostrarResultado(r) {
  $('res-aporte').textContent = fmtBRL.format(r.aporte);
  $('res-prazo').textContent = `${MESES_NOME[r.dataAlvo.mes - 1]} de ${r.dataAlvo.ano}`;
  $('res-hoje').textContent = fmtBRL.format(r.totalHoje);
  $('res-corrigido').textContent = fmtBRL.format(r.totalCorrigido);
  $('res-ja-tem').textContent = fmtBRL.format(r.jaTem);
  $('res-aportado').textContent = fmtBRL.format(r.totalAportado);
  $('res-rendimento').textContent = '+ ' + fmtBRL.format(r.rendimento);
  $('res-premissas').textContent = `Premissas: rendimento de 100% do CDI e inflação pelo IPCA, com as projeções do Boletim Focus de ${PREMISSAS.boletim.split('-').reverse().join('/')} (Banco Central). Sugestões de gasto são estimativas em valores de hoje. Valores estimados, sem garantia de rentabilidade.`;
  if (r.aporte === 0 && r.totalHoje > 0) {
    $('res-prazo').innerHTML = 'Você já tem o suficiente guardado. Agora é deixar render até <strong>' + `${MESES_NOME[r.dataAlvo.mes - 1]} de ${r.dataAlvo.ano}` + '</strong>!';
  }
  mostrar('tela-resultado');
}

$('btn-ajustar').addEventListener('click', () => mostrar('tela-plano'));
$('btn-acompanhar').addEventListener('click', abrirCaixinha);
$('btn-voltar-resultado').addEventListener('click', () => mostrarResultado(recalcular()));

// ---------- caixinha (acompanhamento) ----------
function cmpMes(a, b) { return (a.ano - b.ano) * 12 + (a.mes - b.mes); }

function abrirCaixinha() {
  if (!planoAtual) return;
  const ini = inicioDoPlano();
  const agora = mesAtual();
  const aporte = Number(planoAtual.aporte_mensal) || 0;
  const inicial = Number(planoAtual.poupanca_inicial) || 0;
  const aportes = planoAtual.aportes || {};

  const plan = serieSaldo({ poupancaInicial: inicial, premissas: PREMISSAS, inicio: ini, aportePorMes: () => aporte });
  const real = serieSaldo({ poupancaInicial: inicial, premissas: PREMISSAS, inicio: ini, aportePorMes: (k) => Number(aportes[k]) || 0 });
  const idxAtual = Math.max(0, Math.min(cmpMes(agora, ini), plan.length - 1));

  const tem = real[idxAtual].saldo;
  const deveria = plan[idxAtual].saldo;
  $('cx-tem').textContent = fmtBRL.format(tem);
  $('cx-deveria').textContent = fmtBRL.format(deveria);
  const dif = tem - deveria;
  const st = $('cx-status');
  if (Math.abs(dif) < Math.max(50, aporte * 0.1)) { st.textContent = 'No ritmo!'; st.className = 'num ok'; }
  else if (dif > 0) { st.textContent = '+' + fmtBRL.format(dif); st.className = 'num ok'; }
  else { st.textContent = fmtBRL.format(dif); st.className = 'num atencao'; }
  $('cx-status-rotulo').textContent = dif >= 0 ? 'Situação' : 'Para recuperar';

  montarLegenda();
  desenharGrafico(plan, real, idxAtual);
  montarListaAportes(ini, agora, aporte, aportes);
  mostrar('tela-caixinha');
}

function montarListaAportes(ini, agora, aporte, aportes) {
  const meses = mesesEntre(ini, PREMISSAS.dataAlvo).filter(m => cmpMes(m, agora) <= 0);
  const div = $('lista-aportes');
  div.textContent = '';
  $('aportes-vazio').style.display = meses.length ? 'none' : 'block';
  for (const m of meses) {
    const k = chaveMes(m);
    const feito = aportes[k] != null;
    const linha = document.createElement('div');
    linha.className = 'aporte-linha';
    linha.innerHTML = `
      <label class="aporte-check"><input type="checkbox" data-mes="${k}" ${feito ? 'checked' : ''}><span>${MESES_NOME[m.mes - 1]}/${m.ano}</span></label>
      <div class="prefixo aporte-valor"><span>R$</span><input type="text" inputmode="numeric" data-valor="${k}" ${feito ? '' : 'disabled'}></div>`;
    div.appendChild(linha);
    const chk = linha.querySelector('input[type="checkbox"]');
    const val = linha.querySelector('input[data-valor]');
    aplicarValor(val, feito ? Number(aportes[k]) : aporte);
    val.addEventListener('input', () => aplicarValor(val, lerValor(val)));
    chk.addEventListener('change', () => {
      val.disabled = !chk.checked;
      if (chk.checked && !lerValor(val)) aplicarValor(val, aporte);
    });
  }
}

$('btn-salvar-aportes').addEventListener('click', async () => {
  const aportes = {};
  document.querySelectorAll('#lista-aportes input[type="checkbox"]').forEach(chk => {
    if (chk.checked) {
      const k = chk.dataset.mes;
      aportes[k] = lerValor(document.querySelector(`input[data-valor="${k}"]`));
    }
  });
  const botao = $('btn-salvar-aportes');
  botao.disabled = true;
  const { error } = await supa.from('copa_planos').update({ aportes }).eq('user_id', usuarioAtual.id);
  botao.disabled = false;
  if (error) return avisar('msg-caixinha', 'Não conseguimos salvar agora. Tente de novo em instantes.', false);
  planoAtual.aportes = aportes;
  avisar('msg-caixinha', 'Aportes salvos!', true);
  abrirCaixinha();
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

function desenharGrafico(plan, real, idxAtual) {
  const svg = $('grafico');
  const W = 640, H = 300, ml = 66, mr = 14, mt = 14, mb = 30;
  const iw = W - ml - mr, ih = H - mt - mb;
  const n = plan.length;
  const ymax = Math.max(plan[n - 1].saldo, real[idxAtual].saldo, 1);
  const passo = nivelBom(ymax);
  const ytop = Math.ceil(ymax / passo) * passo;
  const X = (i) => ml + (i / (n - 1)) * iw;
  const Y = (v) => mt + ih - (v / ytop) * ih;

  let s = '';
  // grade e eixo y
  for (let v = 0; v <= ytop; v += passo) {
    s += `<line x1="${ml}" y1="${Y(v)}" x2="${W - mr}" y2="${Y(v)}" stroke="${v === 0 ? '#c3c2b7' : '#e1e0d9'}" stroke-width="1"/>`;
    s += `<text x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end" class="gr-tick">${fmtNum.format(v)}</text>`;
  }
  // eixo x: um rotulo a cada 6 meses
  for (let i = 0; i < n; i += 6) {
    const p = plan[i];
    s += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="gr-tick">${MESES_ABREV[p.mes - 1]}/${String(p.ano).slice(2)}</text>`;
  }
  // area (10%) e linha do realizado + linha do planejado
  const caminho = (serie, ate) => serie.slice(0, ate + 1).map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.saldo)}`).join('');
  s += `<path d="${caminho(real, idxAtual)}L${X(idxAtual)},${Y(0)}L${X(0)},${Y(0)}Z" fill="${COR_REAL}" opacity="0.1"/>`;
  s += `<path d="${caminho(plan, n - 1)}" fill="none" stroke="${COR_PLAN}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += `<path d="${caminho(real, idxAtual)}" fill="none" stroke="${COR_REAL}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  // marcador no ponto atual do realizado (anel de 2px na cor da superficie)
  s += `<circle cx="${X(idxAtual)}" cy="${Y(real[idxAtual].saldo)}" r="6" fill="#ffffff"/>`;
  s += `<circle cx="${X(idxAtual)}" cy="${Y(real[idxAtual].saldo)}" r="4" fill="${COR_REAL}"/>`;
  // rotulos diretos: fim do planejado (meta) e ponto atual da caixinha
  s += `<text x="${W - mr}" y="${Y(plan[n - 1].saldo) - 8}" text-anchor="end" class="gr-rotulo">meta ${fmtBRL.format(plan[n - 1].saldo)}</text>`;
  const lx = Math.min(X(idxAtual) + 8, W - mr - 60);
  s += `<text x="${lx}" y="${Y(real[idxAtual].saldo) + (idxAtual < 3 ? -12 : 20)}" class="gr-rotulo">${fmtBRL.format(real[idxAtual].saldo)}</text>`;
  // crosshair (atualizado no pointermove)
  s += `<line id="gr-mira" x1="0" y1="${mt}" x2="0" y2="${mt + ih}" stroke="#898781" stroke-width="1" opacity="0"/>`;
  s += `<rect id="gr-hit" x="${ml}" y="${mt}" width="${iw}" height="${ih}" fill="transparent"/>`;
  svg.innerHTML = s;

  // tooltip: mostra as duas series no mes apontado
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
    if (i <= idxAtual) linhas.unshift([fmtBRL.format(Math.round(real[i].saldo)), 'sua caixinha', COR_REAL]);
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
    tt.style.top = '18px';
  }
  hit.addEventListener('pointermove', moverTooltip);
  hit.addEventListener('pointerleave', () => { tt.classList.add('oculto'); mira.setAttribute('opacity', '0'); });
}

// ---------- estado inicial ----------
(async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (session) entrarNoPlano(session.user);
  else mostrar('tela-auth');
})();
