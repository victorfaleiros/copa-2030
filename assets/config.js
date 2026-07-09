// Configuracao da Comunidade Copa 2030
// Edite aqui: categorias de gasto, premissas do Focus e chaves do Supabase.

const SUPABASE_URL = 'https://oumcsjqiuitzosrgnhbr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K-AO_54wSlVX5_iBNuaRAQ_JkCpo_zc';

// E-mails com acesso ao painel admin (precisam bater com as policies do banco)
const ADMIN_EMAILS = ['victorfaleiros@outlook.com', 'victorfaleiros@actgrupo.com.br'];

// Tipos de gasto da viagem (valores em R$ de hoje). Edite nomes e dicas a vontade.
const CATEGORIAS = [
  { id: 'passagens',   nome: 'Passagens aéreas',  dica: 'ida e volta até a sede da Copa' },
  { id: 'hospedagem',  nome: 'Hospedagem',        dica: 'total das noites da viagem' },
  { id: 'ingressos',   nome: 'Ingressos',         dica: 'jogos que você quer assistir' },
  { id: 'alimentacao', nome: 'Alimentação',       dica: 'refeições durante a viagem' },
  { id: 'transporte',  nome: 'Transporte local',  dica: 'trens, metrô e apps entre cidades' },
  { id: 'extras',      nome: 'Extras e compras',  dica: 'passeios, lembranças e imprevistos' },
];

// Premissas do Boletim Focus (medianas anuais). CDI = Selic - 0,10 p.p.
// Meta: junho de 2029, um ano antes da Copa, para comprar tudo com antecedência.
const PREMISSAS = {
  boletim: '2026-07-03',
  dataAlvo: { ano: 2029, mes: 6 },
  cdi:  { 2026: 13.9, 2027: 11.9, 2028: 10.4, 2029: 9.9 },
  ipca: { 2026: 5.3,  2027: 4.2,  2028: 3.7,  2029: 3.5 },
};

if (typeof module !== 'undefined') module.exports = { CATEGORIAS, PREMISSAS, ADMIN_EMAILS };
