# Berbert Hidrotech — App de controle

App para os serviços de desentupimento. Funciona no celular e no computador, pode ser
instalado na tela inicial como um aplicativo e guarda os dados num banco na nuvem
(Supabase, gratuito). Feito para quem trabalha sozinho: rápido de lançar e com o controle
do dinheiro na mão.

## O que o app faz

- **Início**: atalhos (novo serviço, gasto, entrada, orçamento), quanto entrou, quanto gastou,
  quanto sobrou no mês, valores a receber, contas a pagar, serviços em execução e clientes
  para avisar da manutenção preventiva.
- **Serviços** (situação **Em execução** ou **Concluído**), com opções para marcar:
  - o que foi feito (pia, vaso, ralo, esgoto, caixa de gordura, fossa, hidrojateamento, câmera...) e o local;
  - problema relatado, **causa encontrada**, **equipamentos usados**, procedimento e metros de tubulação;
  - **fotos do antes, durante e depois** (câmera ou galeria);
  - garantia, recomendações e **manutenção preventiva** (avisar o cliente daqui a X meses);
  - valor (itens da tabela de preços, desconto), forma de pagamento, pago ou a receber;
  - **assinatura do cliente na tela** do celular;
  - **gastos do serviço** (material, combustível, descarte...) e o **lucro** de cada serviço.
- **Laudo técnico com fotos** e **recibo** (com valor por extenso): imprimir, salvar em PDF ou
  **enviar pelo WhatsApp** (no celular o PDF já vai anexado).
- **Aviso de garantia**: ao abrir um serviço novo para um cliente com serviço ainda na garantia, o app avisa.
- **Clientes**: cadastro simples, busca, botões de ligar, WhatsApp e abrir o endereço no mapa,
  histórico de serviços, total gasto e quanto falta receber.
- **Orçamentos**: itens e valores, PDF pelo WhatsApp; quando o cliente aprova, vira serviço com um toque.
- **Financeiro**: entradas e gastos do mês por categoria e forma de pagamento, gráfico dos
  últimos 6 meses, **a receber** (com botão "Recebi" e lembrete de pagamento pelo WhatsApp com a chave Pix),
  **contas a pagar**, **gastos fixos do mês** (DAS do MEI, celular...), resumo do ano com o
  **limite do MEI** e planilha do mês para o contador.
- **Retornos**: clientes da manutenção preventiva (caixa de gordura, fossa, condomínio) que
  estão vencendo, com mensagem pronta no WhatsApp.
- **Funciona sem internet**: se o sinal cair, o que for salvo fica guardado no aparelho e é
  enviado sozinho quando a internet voltar (aparece um aviso laranja no topo). Só as fotos
  precisam de internet na hora.
- **Configurações**: dados da empresa, tabela de preços, gastos fixos, garantia padrão,
  mensagens do WhatsApp e backup.

## Instalação (uma única vez, cerca de 15 minutos)

### 1. Criar o banco de dados no Supabase (grátis)

1. Entre em <https://supabase.com> e clique em **New project** (pode ser na mesma conta da
   Pest Control, mas **um projeto novo**, para os dados não se misturarem). Nome: `hidrotech`,
   região **South America (São Paulo)**.
2. No menu lateral, abra **SQL Editor → New query**, cole todo o conteúdo do arquivo
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Vá em **Authentication → Sign In / Providers → Email** e **desative "Allow new users to sign up"**
   (assim ninguém de fora consegue criar login).
4. Vá em **Authentication → Users → Add user → Create new user**, informe o **seu** e-mail e
   senha e marque **Auto Confirm User**. O primeiro login criado já entra liberado.

### 2. Ligar o app ao banco

1. No Supabase, clique em **Connect** (ou **Project Settings → API**) e copie a **Project URL**
   e a chave **anon public** / **publishable key**.
2. Cole os dois valores no arquivo [`js/config.js`](js/config.js).

Essa chave pode ficar no código: sozinha ela não abre os dados, que são protegidos pelo
login e pelas regras do banco. **Nunca** coloque a chave `service_role` / `secret` nesse arquivo.

### 3. Publicar (GitHub Pages, grátis)

1. No GitHub, vá em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)`.
2. O app ficará em `https://gustavoberbetxavier.github.io/Berbert-HIdrotech/`.
3. No Supabase, em **Authentication → URL Configuration**, coloque esse endereço em **Site URL**
   (usado no e-mail de "Esqueci a senha").
4. No celular, abra o endereço no Chrome e toque em **"Adicionar à tela inicial"**.

### Liberar outro login (opcional)

Se um dia alguém precisar usar junto (ajudante, secretária), crie o login em
**Authentication → Users → Add user** e libere no **SQL Editor**:

```sql
update public.perfis set ativo = true where email = 'email@da.pessoa';
```

As duas pessoas veem os mesmos dados.

## Primeiros passos no app

1. **Configurações**: preencha os dados da empresa (saem no laudo e no recibo), a chave Pix e os
   valores da **tabela de preços**. Cadastre os **gastos fixos** do mês.
2. Toque no **+** laranja (no celular) para lançar um serviço, gasto, entrada, orçamento ou cliente.
3. No fim do serviço, toque em **Salvar e concluir** e depois em **Laudo pelo WhatsApp**.

## Estrutura

```
index.html            página principal
css/style.css         visual (mesmas cores da Berbert Pest Control)
js/config.js          endereço e chave do Supabase
js/db.js              login, banco de dados e fila para funcionar sem internet
js/app.js             utilitários (formulários, fotos, PDF, WhatsApp)
js/clientes.js        clientes
js/servicos.js        serviços (laudo, fotos, valores, assinatura)
js/documentos.js      laudo, recibo e orçamento impressos / PDF
js/orcamentos.js      orçamentos
js/financeiro.js      gastos, entradas, a receber, contas a pagar, resumo do ano
js/inicio.js          início, retornos, configurações, menu e login
js/vendor/            Supabase (v2.116.0) e html2pdf
supabase/schema.sql   tabelas e regras de segurança do banco
img/                  logo e ícones
sw.js, manifest.json  instalação como aplicativo
```
