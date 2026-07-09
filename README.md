# Comunidade Copa 2030

Ferramenta de captação de leads da campanha do Instagram: a pessoa cria uma conta, monta o orçamento da viagem para a Copa do Mundo de 2030 e descobre quanto precisa guardar por mês até junho de 2029 (um ano antes da Copa, para comprar tudo com antecedência).

## Páginas

- `index.html`: página pública da campanha (cadastro, login, orçamento e resultado).
- `admin.html`: painel restrito para ver todos os planos e baixar CSV. Só os e-mails em `ADMIN_EMAILS` (que batem com as policies do banco) enxergam os dados.

## Como funciona o cálculo

Mesma filosofia do planejamento de aposentadoria da plataforma (`lib/retirement.js` do act-asset-allocation):

1. A pessoa preenche os gastos em valores de hoje.
2. O total é corrigido pela inflação (IPCA projetado pelo Boletim Focus, ano a ano) até junho de 2029.
3. A poupança rende 100% do CDI (Selic projetada pelo Focus menos 0,10 p.p., ano a ano), com capitalização mensal.
4. Uma busca binária encontra o aporte mensal que faz o saldo chegar ao valor corrigido na data-alvo.

## Configuração

Tudo editável em `assets/config.js`:

- `CATEGORIAS`: tipos de gasto exibidos no formulário.
- `PREMISSAS`: medianas do Focus (CDI e IPCA por ano) e data-alvo. Atualizar quando sair um Focus novo relevante (fonte: API Olinda do BCB, `ExpectativasMercadoAnuais`).
- `ADMIN_EMAILS`: e-mails com acesso ao painel. Precisa estar em sincronia com a policy `copa_select_proprio` no Supabase.

## Backend

Supabase, projeto `vfaleiros` (`oumcsjqiuitzosrgnhbr`), tabela `public.copa_planos` com RLS:

- Usuário autenticado insere/edita/lê apenas a própria linha (`user_id = auth.uid()`).
- Os e-mails admin leem todas as linhas.
- Papel `anon` não tem acesso nenhum à tabela.

Migrações: `copa2030_planos` e `copa2030_grants`.

## Publicação

Site estático no GitHub Pages (branch `main`, raiz). Sem build, sem servidor.
