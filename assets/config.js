// Configuracao da Comunidade Copa 2030
// Edite aqui: categorias de gasto, referencias de preco, premissas do Focus e chaves do Supabase.

const SUPABASE_URL = 'https://oumcsjqiuitzosrgnhbr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K-AO_54wSlVX5_iBNuaRAQ_JkCpo_zc';

// E-mails com acesso ao painel admin (precisam bater com as policies do banco)
const ADMIN_EMAILS = ['victorfaleiros@outlook.com', 'victorfaleiros@actgrupo.com.br'];

// Niveis das referencias de preco (sempre 3 valores: economico, medio, premium)
const NIVEIS = ['Econômico', 'Médio', 'Premium'];

// Categorias de gasto. Valores de referencia em R$ DE HOJE, POR PESSOA.
// ref: [economico, medio, premium]. Para jogos (tipo 'jogos'), referencia POR JOGO por pessoa.
// 'meia: true' renderiza em meia coluna (pares Brasil x aleatorio ficam lado a lado).
// Base das estimativas (jul/2026): voos GRU-LIS R$4,2-4,7 mil fora da Copa; diarias em Lisboa
// R$180-930+; ingressos da Copa 2026 de US$60 (grupos) a US$1.200+ (mata-mata, preco dinamico).
const CATEGORIAS = [
  { id: 'passagens',   nome: 'Passagens Brasil ⇄ Portugal', dica: 'ida e volta, por pessoa', ref: [5500, 8500, 20000] },
  { id: 'hospedagem',  nome: 'Hospedagem em Lisboa', dica: 'cerca de 10 noites, por pessoa em quarto duplo', ref: [3000, 6000, 14000] },
  { id: 'jogos_grupo_brasil', nome: '🇧🇷 Fase de grupos · Brasil', dica: 'jogos do Brasil', tipo: 'jogos', meia: true,
    qtdMin: 0, qtdMax: 3, qtdPadrao: 1, ref: [1800, 3500, 7000] },
  { id: 'jogos_grupo_aleatorio', nome: '🌍 Fase de grupos · outros', dica: 'jogos de outras seleções', tipo: 'jogos', meia: true,
    qtdMin: 0, qtdMax: 3, qtdPadrao: 0, ref: [400, 900, 2500] },
  { id: 'jogos_mata_brasil', nome: '🇧🇷 Mata-mata · Brasil', dica: 'das oitavas em diante', tipo: 'jogos', meia: true,
    qtdMin: 0, qtdMax: 4, qtdPadrao: 1, ref: [2500, 5000, 10000] },
  { id: 'jogos_mata_aleatorio', nome: '🌍 Mata-mata · outros', dica: 'a final custa bem mais', tipo: 'jogos', meia: true,
    qtdMin: 0, qtdMax: 4, qtdPadrao: 0, ref: [800, 2000, 5000] },
  { id: 'alimentacao', nome: 'Alimentação', dica: 'cerca de 10 dias, por pessoa', ref: [1500, 3000, 7000] },
  { id: 'aereos',      nome: 'Aéreos internos', dica: 'voos para jogos em outras sedes (Espanha e Marrocos)', ref: [600, 1500, 3500] },
  { id: 'transportes', nome: 'Transportes internos', dica: 'metrô, ônibus, Uber e aluguel de carro', ref: [400, 1000, 2500] },
  { id: 'extras',      nome: 'Extras e compras', dica: 'passeios, lembranças e imprevistos', ref: [500, 1500, 4000] },
];

// Migracao dos planos antigos (v2 juntava Brasil e aleatorio numa categoria so)
const MIGRACAO_GASTOS = { jogos_grupo: 'jogos_grupo_brasil', jogos_mata: 'jogos_mata_brasil' };

// Premissas do Boletim Focus (medianas anuais). CDI = Selic - 0,10 p.p.
// Meta: junho de 2029, um ano antes da Copa, para comprar tudo com antecedência.
const PREMISSAS = {
  boletim: '2026-07-03',
  dataAlvo: { ano: 2029, mes: 6 },
  cdi:  { 2026: 13.9, 2027: 11.9, 2028: 10.4, 2029: 9.9 },
  ipca: { 2026: 5.3,  2027: 4.2,  2028: 3.7,  2029: 3.5 },
};

if (typeof module !== 'undefined') module.exports = { CATEGORIAS, PREMISSAS, ADMIN_EMAILS, NIVEIS, MIGRACAO_GASTOS };
