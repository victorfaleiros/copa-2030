// Painel admin da Comunidade Copa 2030: lista todos os planos (RLS libera so os e-mails admin).

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const $ = (id) => document.getElementById(id);

let planos = [];

function mostrarLogin() { $('tela-login').classList.remove('oculto'); $('tela-painel').classList.add('oculto'); }
function mostrarPainel() { $('tela-login').classList.add('oculto'); $('tela-painel').classList.remove('oculto'); }

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { data, error } = await supa.auth.signInWithPassword({
    email: $('log-email').value.trim(),
    password: $('log-senha').value,
  });
  const msg = $('msg-login');
  if (error) { msg.textContent = 'E-mail ou senha incorretos.'; msg.className = 'mensagem erro'; return; }
  if (!ADMIN_EMAILS.includes(data.session.user.email)) {
    await supa.auth.signOut();
    msg.textContent = 'Essa conta não tem acesso ao painel.';
    msg.className = 'mensagem erro';
    return;
  }
  carregar();
});

$('btn-sair').addEventListener('click', async () => { await supa.auth.signOut(); mostrarLogin(); });

async function carregar() {
  const { data, error } = await supa.from('copa_planos').select('*').order('created_at', { ascending: false });
  if (error) { mostrarLogin(); return; }
  planos = data || [];
  render();
  mostrarPainel();
}

function render() {
  $('kpi-leads').textContent = planos.length;
  $('kpi-aportes').textContent = fmtBRL.format(planos.reduce((s, p) => s + Number(p.aporte_mensal || 0), 0));
  $('kpi-ticket').textContent = fmtBRL.format(planos.length ? planos.reduce((s, p) => s + Number(p.total_hoje || 0), 0) / planos.length : 0);

  const cols = [
    { titulo: 'Nome', f: p => p.nome },
    { titulo: 'E-mail', f: p => p.email },
    { titulo: 'WhatsApp', f: p => p.whatsapp || '' },
    { titulo: 'Contato ok', f: p => p.aceita_contato ? 'Sim' : 'Não' },
    { titulo: 'Pessoas', f: p => p.pessoas || 1, num: true },
    ...CATEGORIAS.map(c => ({ titulo: c.nome, f: p => fmtBRL.format((p.gastos && p.gastos[c.id]) || 0), num: true })),
    { titulo: 'Viagem (hoje)', f: p => fmtBRL.format(p.total_hoje || 0), num: true },
    { titulo: 'Corrigido 2029', f: p => fmtBRL.format(p.total_corrigido || 0), num: true },
    { titulo: 'Já guardado', f: p => fmtBRL.format(p.poupanca_inicial || 0), num: true },
    { titulo: 'Aporte/mês', f: p => fmtBRL.format(p.aporte_mensal || 0), num: true },
    { titulo: 'Aportes feitos', f: p => Object.keys(p.aportes || {}).length, num: true },
    { titulo: 'Total aportado', f: p => fmtBRL.format(Object.values(p.aportes || {}).reduce((s, v) => s + Number(v || 0), 0)), num: true },
    { titulo: 'Criado em', f: p => fmtData.format(new Date(p.created_at)) },
    { titulo: 'Atualizado', f: p => fmtData.format(new Date(p.updated_at)) },
  ];

  $('cabecalho').innerHTML = '<tr>' + cols.map(c => `<th>${c.titulo}</th>`).join('') + '</tr>';
  $('linhas').innerHTML = planos.map(p =>
    '<tr>' + cols.map(c => `<td class="${c.num ? 'num' : ''}">${escapar(String(c.f(p)))}</td>`).join('') + '</tr>'
  ).join('');
  $('vazio').style.display = planos.length ? 'none' : 'block';
}

function escapar(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

$('btn-csv').addEventListener('click', () => {
  const cab = ['nome', 'email', 'whatsapp', 'aceita_contato', 'pessoas', ...CATEGORIAS.map(c => c.id),
    'total_hoje', 'total_corrigido', 'poupanca_inicial', 'aporte_mensal', 'meses',
    'aportes_feitos', 'total_aportado', 'created_at', 'updated_at'];
  const linhas = planos.map(p => [
    p.nome, p.email, p.whatsapp || '', p.aceita_contato ? 'sim' : 'nao', p.pessoas || 1,
    ...CATEGORIAS.map(c => (p.gastos && p.gastos[c.id]) || 0),
    p.total_hoje, p.total_corrigido, p.poupanca_inicial, p.aporte_mensal, p.meses,
    Object.keys(p.aportes || {}).length,
    Object.values(p.aportes || {}).reduce((s, v) => s + Number(v || 0), 0),
    p.created_at, p.updated_at,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  const csv = '﻿' + cab.join(';') + '\n' + linhas.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'copa2030-planos.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

(async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (session && ADMIN_EMAILS.includes(session.user.email)) carregar();
  else mostrarLogin();
})();
