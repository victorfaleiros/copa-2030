// App da Comunidade Copa 2030: login simples, orcamento da viagem e plano de aportes.

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('pt-BR');
const MESES_NOME = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const $ = (id) => document.getElementById(id);
const telas = ['tela-auth', 'tela-plano', 'tela-resultado'];
function mostrar(tela) { telas.forEach(t => $(t).classList.toggle('oculto', t !== tela)); }

// ---------- campos de dinheiro ----------
function lerValor(input) {
  const digitos = String(input.value).replace(/\D/g, '');
  return digitos ? parseInt(digitos, 10) : 0;
}
function mascararDinheiro(input) {
  input.addEventListener('input', () => {
    const v = lerValor(input);
    input.value = v ? fmtNum.format(v) : '';
    atualizarTotal();
  });
}

// ---------- monta os campos de gasto ----------
const lista = $('lista-gastos');
for (const cat of CATEGORIAS) {
  const div = document.createElement('div');
  div.className = 'campo';
  div.innerHTML = `
    <label for="gasto-${cat.id}">${cat.nome} <span class="dica">${cat.dica}</span></label>
    <div class="prefixo"><span>R$</span><input id="gasto-${cat.id}" type="text" inputmode="numeric" placeholder="0"></div>`;
  lista.appendChild(div);
}
document.querySelectorAll('#form-plano input[inputmode="numeric"]').forEach(mascararDinheiro);

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

async function entrarNoPlano(user) {
  usuarioAtual = user;
  const nome = (user.user_metadata && user.user_metadata.nome) || '';
  $('saudacao').textContent = nome ? `${nome.split(' ')[0]}, monte o orçamento da sua viagem` : 'Monte o orçamento da sua viagem';

  const { data: plano } = await supa.from('copa_planos').select('*').eq('user_id', user.id).maybeSingle();
  if (plano) {
    for (const cat of CATEGORIAS) {
      const v = (plano.gastos && plano.gastos[cat.id]) || 0;
      $(`gasto-${cat.id}`).value = v ? fmtNum.format(v) : '';
    }
    $('poupanca').value = plano.poupanca_inicial > 0 ? fmtNum.format(plano.poupanca_inicial) : '';
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
  mostrar('tela-auth');
}
$('sair-1').addEventListener('click', sair);
$('sair-2').addEventListener('click', sair);

// ---------- calculo e gravacao ----------
function recalcular() {
  const { total, gastos } = somarGastos();
  const poupanca = lerValor($('poupanca'));
  const r = calcularPlano({ totalHoje: total, poupancaInicial: poupanca, premissas: PREMISSAS });
  return { ...r, gastos };
}

$('form-plano').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = recalcular();
  if (r.totalHoje <= 0) return avisar('msg-plano', 'Preencha ao menos um gasto para calcular o seu plano.', false);

  const botao = e.target.querySelector('button[type="submit"]');
  botao.disabled = true;
  const meta = usuarioAtual.user_metadata || {};
  const { error } = await supa.from('copa_planos').upsert({
    user_id: usuarioAtual.id,
    nome: meta.nome || '',
    email: usuarioAtual.email,
    whatsapp: meta.whatsapp || '',
    aceita_contato: meta.aceita_contato !== false,
    poupanca_inicial: r.jaTem,
    gastos: r.gastos,
    total_hoje: r.totalHoje,
    total_corrigido: r.totalCorrigido,
    aporte_mensal: r.aporte,
    meses: r.meses,
    premissas: { boletim: PREMISSAS.boletim, cdi: PREMISSAS.cdi, ipca: PREMISSAS.ipca, dataAlvo: PREMISSAS.dataAlvo },
  }, { onConflict: 'user_id' });
  botao.disabled = false;
  if (error) return avisar('msg-plano', 'Não conseguimos salvar agora. Tente de novo em instantes.', false);

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
  $('res-premissas').textContent = `Premissas: rendimento de 100% do CDI e inflação pelo IPCA, com as projeções do Boletim Focus de ${PREMISSAS.boletim.split('-').reverse().join('/')} (Banco Central). Valores estimados, sem garantia de rentabilidade.`;
  if (r.aporte === 0 && r.totalHoje > 0) {
    $('res-prazo').innerHTML = 'Você já tem o suficiente guardado. Agora é deixar render até <strong>' + `${MESES_NOME[r.dataAlvo.mes - 1]} de ${r.dataAlvo.ano}` + '</strong>!';
  }
  mostrar('tela-resultado');
}

$('btn-ajustar').addEventListener('click', () => mostrar('tela-plano'));

// ---------- estado inicial ----------
(async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (session) entrarNoPlano(session.user);
  else mostrar('tela-auth');
})();
