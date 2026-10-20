// Financeiro: entradas (serviços recebidos e outras entradas), gastos, contas a pagar,
// valores a receber, gastos fixos do mês e resumo do ano (com o limite do MEI).

const CATEGORIAS_GASTO = ['Combustível', 'Material / peças', 'Ferramentas e equipamentos', 'Manutenção do veículo',
  'Manutenção de equipamentos', 'Alimentação', 'Pedágio / estacionamento', 'Descarte de resíduos', 'Ajudante / mão de obra',
  'Impostos / DAS MEI', 'Telefone / internet', 'Propaganda / divulgação', 'Aluguel', 'Outros'];
const CATEGORIAS_ENTRADA = ['Serviço avulso', 'Venda de material', 'Empréstimo / aporte', 'Outros'];

/* ---------- Cálculos ---------- */
const noMes = (data, am) => String(data || '').slice(0, 7) === am;
// Dinheiro que entrou: serviços pagos (na data do recebimento) e outras entradas.
function entradasDoMes(am) {
  const servicos = DB.listar('servicos').filter((s) => s.pago && noMes(s.dataPagamento || s.data, am))
    .map((s) => ({ origem: 'servico', id: s.id, data: s.dataPagamento || s.data, descricao: `Serviço nº ${s.numero} - ${nomeCliente(s.clienteId)}`,
      categoria: 'Serviços', forma: s.forma, valor: valorServico(s) }));
  const outras = DB.listar('lancamentos').filter((l) => l.tipo === 'entrada' && noMes(l.data, am))
    .map((l) => ({ origem: 'lancamento', ...l, valor: Number(l.valor) || 0 }));
  return [...servicos, ...outras];
}
const gastosDoMes = (am) => DB.listar('lancamentos').filter((l) => l.tipo === 'gasto' && l.pago !== false && noMes(l.data, am))
  .map((l) => ({ origem: 'lancamento', ...l, valor: Number(l.valor) || 0 }));
const somar = (lista) => lista.reduce((t, x) => t + (Number(x.valor) || 0), 0);
const aReceber = () => DB.listar('servicos').filter((s) => !s.pago && valorServico(s) > 0);
const contasAPagar = () => DB.listar('lancamentos').filter((l) => l.tipo === 'gasto' && l.pago === false)
  .sort((a, b) => (a.vencimento || a.data || '').localeCompare(b.vencimento || b.data || ''));
const mesAtual = () => hojeISO().slice(0, 7);
// Gastos fixos (Configurações) que ainda não foram lançados no mês.
function fixosPendentes(am) {
  const lancados = new Set(DB.listar('lancamentos').filter((l) => l.fixoId && l.mesFixo === am).map((l) => l.fixoId));
  return (DB.config().gastosFixos || []).filter((f) => f.id && !lancados.has(f.id));
}

/* ---------- Formulário de gasto / entrada ---------- */
function formLancamento(id, padrao = {}, aoSalvar) {
  const l = DB.obter('lancamentos', id) || { tipo: 'gasto', data: hojeISO(), pago: true, forma: 'Pix', ...padrao };
  const gasto = l.tipo === 'gasto';
  const servicosRecentes = DB.listar('servicos').sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 40);
  if (l.servicoId && !servicosRecentes.some((s) => s.id === l.servicoId) && DB.obter('servicos', l.servicoId)) servicosRecentes.unshift(DB.obter('servicos', l.servicoId));
  let comprovante = l.comprovante || '';
  abrirModal(`${id ? 'Editar' : 'Novo'} ${gasto ? 'gasto' : 'entrada'}`, `
    <form class="form" id="form-lanc">
      ${campo('Valor (R$) *', 'valor', l.valor, 'dinheiro', 'required')}
      ${campo('Data', 'data', l.data, 'date', 'required')}
      <div class="campo-escolha full"><span>Categoria</span>${botoesCategoria(gasto ? CATEGORIAS_GASTO : CATEGORIAS_ENTRADA, l.categoria)}</div>
      ${campo('Descrição', 'descricao', l.descricao, 'text', `full placeholder="${gasto ? 'Ex.: gasolina, mola 10 m, almoço...' : 'Ex.: venda de sifão'}"`)}
      <label>Forma de pagamento<select name="forma">${opcoesSimples(FORMAS_PAGAMENTO, l.forma)}</select></label>
      ${gasto ? `<label>Ligado a um serviço (opcional)<select name="servicoId"><option value="">— nenhum —</option>
        ${servicosRecentes.map((s) => `<option value="${s.id}" ${s.id === l.servicoId ? 'selected' : ''}>nº ${s.numero} - ${esc(nomeCliente(s.clienteId))} (${dataBR(s.data)})</option>`).join('')}</select></label>
        <label class="check full"><input type="checkbox" name="pago" ${l.pago !== false ? 'checked' : ''}> Já está pago</label>
        <div class="full form" id="campo-venc" style="padding:0">${campo('Vencimento', 'vencimento', l.vencimento || hojeISO(), 'date')}</div>
        <div class="full"><div class="fotos-cab"><b style="font-size:13px;color:var(--suave)">Foto do comprovante / nota (opcional)</b>
          <label class="btn sec peq">Foto<input type="file" accept="image/*" id="comprovante" hidden></label></div>
          <div id="ver-comprovante"></div></div>` : ''}
      <div class="form-acoes">
        ${id ? '<button type="button" class="btn sec perigo-texto" id="excluir" style="margin-right:auto">Excluir</button>' : ''}
        <button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" id="salvar-lanc">Salvar</button></div>
    </form>`, (raiz) => {
    const form = $('#form-lanc', raiz);
    $('#cancelar', raiz).addEventListener('click', fecharModal);
    if (gasto) {
      const venc = () => ($('#campo-venc', raiz).hidden = form.pago.checked);
      form.pago.addEventListener('change', venc);
      venc();
      const mostrar = async () => {
        const caixa = $('#ver-comprovante', raiz);
        if (!comprovante) { caixa.innerHTML = ''; return; }
        caixa.innerHTML = '<p class="ajuda">Carregando foto...</p>';
        try {
          const url = (await urlsFotos([comprovante]))[comprovante];
          caixa.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" class="comprovante-mini" alt="Comprovante"></a>
            <button type="button" class="btn sec peq" id="tirar-comp">Remover foto</button>`;
          $('#tirar-comp', raiz).addEventListener('click', () => { comprovante = ''; mostrar(); });
        } catch (err) { caixa.innerHTML = `<p class="ajuda">${esc(err.message)}</p>`; }
      };
      mostrar();
      $('#comprovante', raiz).addEventListener('change', async (e) => {
        const arq = e.target.files[0];
        e.target.value = '';
        if (!arq) return;
        const b = $('#salvar-lanc', raiz);
        await enviando(b, async () => {
          const blob = await comprimirFoto(arq);
          const caminho = `gastos/${DB.novoId()}.jpg`;
          await DB.enviarFoto(caminho, blob);
          comprovante = caminho;
          mostrar();
        }, 'Enviando foto...');
      });
    }
    if ($('#excluir', raiz)) {
      $('#excluir', raiz).addEventListener('click', () => {
        if (!confirmar('Excluir este lançamento?')) return;
        DB.remover('lancamentos', id);
        if (l.comprovante) DB.removerFotos([l.comprovante]).catch(() => {});
        fecharModal();
        if (aoSalvar) aoSalvar(); else render();
      });
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = lerForm(form);
      const valor = num(d.valor);
      if (!valor) { avisar('Informe o valor.', 'erro'); return; }
      const categoria = ($('[name=categoria]:checked', raiz) || {}).value || 'Outros';
      const pago = gasto ? d.pago : true;
      if (l.comprovante && l.comprovante !== comprovante) DB.removerFotos([l.comprovante]).catch(() => {});
      DB.salvarItem('lancamentos', {
        ...(id ? { id } : {}), ...(l.fixoId ? { fixoId: l.fixoId, mesFixo: l.mesFixo } : {}),
        tipo: l.tipo, valor, data: d.data, categoria, descricao: d.descricao, forma: d.forma,
        servicoId: gasto ? d.servicoId || '' : '', pago, vencimento: pago ? '' : d.vencimento, comprovante: gasto ? comprovante : '',
      });
      fecharModal();
      avisar(gasto ? 'Gasto salvo.' : 'Entrada salva.');
      if (aoSalvar) aoSalvar(); else render();
    });
  });
}
function botoesCategoria(lista, atual) {
  const sel = atual && lista.includes(atual) ? atual : '';
  return `<div class="escolha categorias">${[...lista, ...(atual && !sel ? [atual] : [])].map((c) => `<label class="escolha-op">
    <input type="radio" name="categoria" value="${esc(c)}" ${c === atual ? 'checked' : ''}><span>${esc(c)}</span></label>`).join('')}</div>`;
}

/* ---------- Tela ---------- */
function financeiro(el) {
  const est = estado('financeiro', { mes: mesAtual(), aba: 'resumo' });
  const am = est.mes;
  const entradas = entradasDoMes(am), gastos = gastosDoMes(am);
  const totE = somar(entradas), totG = somar(gastos);
  const receber = aReceber(), pagar = contasAPagar(), fixos = fixosPendentes(am);
  const abas = [['resumo', 'Resumo'], ['lancamentos', 'Lançamentos'], ['receber', `A receber`, receber.length], ['pagar', 'Contas a pagar', pagar.length + fixos.length], ['ano', 'Ano']];
  el.innerHTML = `
    <div class="cabecalho"><h2>Financeiro</h2><div class="acoes">
      <button class="btn" id="novo-gasto">+ Gasto</button><button class="btn sec" id="nova-entrada">+ Entrada</button></div></div>
    <div class="mes-nav"><button class="btn sec peq" data-mes="-1" aria-label="Mês anterior">&lsaquo;</button>
      <strong>${nomeMes(am)}</strong><button class="btn sec peq" data-mes="1" aria-label="Próximo mês">&rsaquo;</button>
      ${am !== mesAtual() ? '<button class="btn sec peq" data-mes="0">Hoje</button>' : ''}</div>
    <div class="grade-kpi">
      <div class="kpi"><div class="rotulo">Entrou</div><div class="valor texto-verde">${moeda(totE)}</div></div>
      <div class="kpi"><div class="rotulo">Gastos</div><div class="valor texto-vermelho">${moeda(totG)}</div></div>
      <div class="kpi destaque"><div class="rotulo">Sobrou (lucro)</div><div class="valor ${totE - totG < 0 ? 'texto-vermelho' : ''}">${moeda(totE - totG)}</div></div>
      <div class="kpi"><div class="rotulo">A receber (total)</div><div class="valor">${moeda(somar(receber.map((s) => ({ valor: valorServico(s) }))))}</div></div>
    </div>
    <div class="abas">${abas.map(([v, r, n]) => `<button class="aba ${est.aba === v ? 'ativa' : ''}" data-aba="${v}">${r}${n ? ` <span class="cont">${n}</span>` : ''}</button>`).join('')}</div>
    <div id="conteudo-fin"></div>`;
  const caixa = $('#conteudo-fin', el);
  if (est.aba === 'resumo') resumoFinanceiro(caixa, am, entradas, gastos);
  if (est.aba === 'lancamentos') lancamentosMes(caixa, am, entradas, gastos);
  if (est.aba === 'receber') abaReceber(caixa, receber);
  if (est.aba === 'pagar') abaPagar(caixa, pagar, fixos, am);
  if (est.aba === 'ano') resumoAno(caixa, am.slice(0, 4));
  $('.mes-nav', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-mes]');
    if (!b) return;
    est.mes = b.dataset.mes === '0' ? mesAtual() : somarMesAM(est.mes, Number(b.dataset.mes));
    render();
  });
  $('.abas', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-aba]');
    if (b) { est.aba = b.dataset.aba; render(); }
  });
  $('#novo-gasto', el).addEventListener('click', () => formLancamento(null, { tipo: 'gasto' }));
  $('#nova-entrada', el).addEventListener('click', () => formLancamento(null, { tipo: 'entrada', categoria: 'Serviço avulso' }));
}

function barras(lista, cor = '') {
  const max = Math.max(1, ...lista.map(([, v]) => v));
  return `<div class="barras">${lista.map(([rotulo, v]) => `<div class="barra-linha"><span class="barra-rot">${esc(rotulo)}</span>
    <span class="barra-trilho"><span class="barra ${cor}" style="width:${Math.max(2, (v / max) * 100)}%"></span></span><b>${moeda(v)}</b></div>`).join('')}</div>`;
}
function agrupar(lista, chave) {
  const m = new Map();
  lista.forEach((x) => m.set(x[chave] || 'Outros', (m.get(x[chave] || 'Outros') || 0) + (Number(x.valor) || 0)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function resumoFinanceiro(caixa, am, entradas, gastos) {
  const meses = Array.from({ length: 6 }, (_, i) => somarMesAM(am, i - 5));
  const dados = meses.map((m) => ({ m, e: somar(entradasDoMes(m)), g: somar(gastosDoMes(m)) }));
  const max = Math.max(1, ...dados.flatMap((d) => [d.e, d.g]));
  const servicosMes = DB.listar('servicos').filter((s) => noMes(s.data, am));
  const faturado = servicosMes.reduce((t, s) => t + valorServico(s), 0);
  caixa.innerHTML = `
    <div class="cartao"><h3>Últimos 6 meses</h3>
      <div class="grafico">${dados.map((d) => `<div class="grafico-col ${d.m === am ? 'atual' : ''}">
        <div class="grafico-barras"><span class="gb entrada" style="height:${(d.e / max) * 100}%" title="Entrou ${moeda(d.e)}"></span>
          <span class="gb gasto" style="height:${(d.g / max) * 100}%" title="Gastos ${moeda(d.g)}"></span></div>
        <small>${mesAbrev(d.m)}</small><small class="${d.e - d.g < 0 ? 'texto-vermelho' : 'texto-verde'}">${moeda(d.e - d.g).replace(',00', '')}</small></div>`).join('')}</div>
      <div class="legenda"><span><i class="gb entrada"></i> Entrou</span><span><i class="gb gasto"></i> Gastos</span><span>Número de baixo = lucro</span></div>
    </div>
    <div class="grade-2">
      <div class="cartao"><h3>Serviços do mês</h3>
        <ul class="lista-simples">
          <li><span>Serviços feitos</span><b>${servicosMes.length}</b></li>
          <li><span>Valor dos serviços</span><b>${moeda(faturado)}</b></li>
          <li><span>Valor médio por serviço</span><b>${moeda(servicosMes.length ? faturado / servicosMes.length : 0)}</b></li>
          <li><span>Ainda não recebido</span><b>${moeda(servicosMes.filter((s) => !s.pago).reduce((t, s) => t + valorServico(s), 0))}</b></li>
        </ul></div>
      <div class="cartao"><h3>Como recebi</h3>${entradas.length ? barras(agrupar(entradas, 'forma'), 'verde') : '<p class="ajuda">Nada recebido neste mês.</p>'}</div>
    </div>
    <div class="cartao"><h3>Para onde foi o dinheiro</h3>${gastos.length ? barras(agrupar(gastos, 'categoria'), 'vermelha') : '<p class="ajuda">Nenhum gasto neste mês.</p>'}</div>`;
}

function lancamentosMes(caixa, am, entradas, gastos) {
  const est = estado('lancamentos', { filtro: 'todos' });
  const todos = [...entradas.map((x) => ({ ...x, tipo: 'entrada' })), ...gastos.map((x) => ({ ...x, tipo: 'gasto' }))]
    .filter((x) => est.filtro === 'todos' || x.tipo === est.filtro)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  caixa.innerHTML = `
    <div class="filtros"><label>Mostrar<select id="filtro">${opcoesSimples([['todos', 'Tudo'], ['entrada', 'Só entradas'], ['gasto', 'Só gastos']], est.filtro)}</select></label>
      <button class="btn sec" id="csv" style="margin-left:auto">Baixar planilha do mês</button></div>
    ${todos.length ? `<div class="lista-cartoes">${todos.map((x) => `<div class="item-lista" data-origem="${x.origem}" data-id="${x.id}">
      <div class="item-info"><b>${esc(x.descricao || x.categoria)}</b>
        <small>${dataBR(x.data)} · ${esc(x.categoria || '')}${x.forma ? ' · ' + esc(x.forma) : ''}${x.servicoId ? ` · serviço nº ${esc((DB.obter('servicos', x.servicoId) || {}).numero || '')}` : ''}</small></div>
      <div class="item-valor ${x.tipo === 'gasto' ? 'texto-vermelho' : 'texto-verde'}">${x.tipo === 'gasto' ? '- ' : ''}${moeda(x.valor)}</div></div>`).join('')}</div>`
      : '<div class="cartao vazio">Nenhum lançamento neste mês.</div>'}`;
  $('#filtro', caixa).addEventListener('change', (e) => { est.filtro = e.target.value; render(); });
  $('#csv', caixa).addEventListener('click', () => {
    const linhas = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Forma de pagamento', 'Valor']];
    [...entradas.map((x) => ({ ...x, tipo: 'Entrada' })), ...gastos.map((x) => ({ ...x, tipo: 'Gasto' }))]
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
      .forEach((x) => linhas.push([dataBR(x.data), x.tipo, x.categoria || '', x.descricao || '', x.forma || '',
        (x.tipo === 'Gasto' ? -1 : 1) * x.valor]));
    const csv = linhas.map((l) => l.map((v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : `"${String(v).replace(/"/g, '""')}"`)).join(';')).join('\r\n');
    baixarArquivo('﻿' + csv, `financeiro-${am}.csv`, 'text/csv;charset=utf-8');
  });
  caixa.addEventListener('click', (e) => {
    const item = e.target.closest('[data-origem]');
    if (!item) return;
    if (item.dataset.origem === 'servico') irPara('servico/' + item.dataset.id);
    else formLancamento(item.dataset.id);
  });
}

function abaReceber(caixa, lista) {
  const ordenada = lista.slice().sort((a, b) => (a.previsaoPagamento || a.data || '').localeCompare(b.previsaoPagamento || b.data || ''));
  caixa.innerHTML = ordenada.length ? `<div class="cartao aviso-linha">Total a receber: <b>${moeda(ordenada.reduce((t, s) => t + valorServico(s), 0))}</b></div>
    <div class="lista-cartoes">${ordenada.map((s) => {
      const cli = DB.obter('clientes', s.clienteId) || {};
      const atrasado = s.previsaoPagamento && s.previsaoPagamento < hojeISO();
      return `<div class="item-lista" data-servico="${s.id}"><div class="item-info"><b>${esc(cli.nome || '—')}</b>
        <small>Serviço nº ${s.numero} · ${dataBR(s.data)}${s.previsaoPagamento ? ` · receber em ${dataBR(s.previsaoPagamento)}` : ''}</small>
        <div class="tags">${atrasado ? tag('Atrasado', 'vermelho') : ''}</div>
        <div class="acoes" style="margin-top:6px"><button class="btn peq" data-recebi="${s.id}">Recebi</button>
          ${cli.telefone ? `<button class="btn sec peq whats" data-cobrar="${s.id}">Lembrar pelo WhatsApp</button>` : ''}</div></div>
        <div class="item-valor">${moeda(valorServico(s))}</div></div>`;
    }).join('')}</div>` : '<div class="cartao vazio">Nada a receber. Tudo em dia!</div>';
  caixa.addEventListener('click', (e) => {
    const r = e.target.closest('[data-recebi]');
    const c = e.target.closest('[data-cobrar]');
    if (r) { receberServico(r.dataset.recebi); return; }
    if (c) {
      const s = DB.obter('servicos', c.dataset.cobrar);
      const cli = DB.obter('clientes', s.clienteId) || {};
      abrirWhats(cli.telefone, preencherMsg(DB.config().msgCobranca || MSG_COBRANCA, {
        nome: cli.contato || cli.nome || '', numero: s.numero, data: dataBR(s.data), valor: moeda(valorServico(s)),
        pix: DB.config().pix ? `Chave Pix: ${DB.config().pix}` : '', empresa: nomeEmpresa(),
      }).trim());
      return;
    }
    const item = e.target.closest('[data-servico]');
    if (item) irPara('servico/' + item.dataset.servico);
  });
}
const MSG_COBRANCA = 'Olá, {nome}! Tudo bem? Passando para lembrar do pagamento do serviço nº {numero} de {data}, no valor de {valor}. {pix} Obrigado! {empresa}.';
function receberServico(id) {
  const s = DB.obter('servicos', id);
  abrirModal(`Receber serviço nº ${s.numero}`, `<form class="form" id="form-receber">
      <p class="full">${esc(nomeCliente(s.clienteId))} — <b>${moeda(valorServico(s))}</b></p>
      ${campo('Data do recebimento', 'dataPagamento', hojeISO(), 'date', 'required')}
      <label>Forma de pagamento<select name="forma">${opcoesSimples(FORMAS_PAGAMENTO, s.forma)}</select></label>
      <div class="form-acoes"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn">Confirmar</button></div>
    </form>`, (raiz) => {
    $('#cancelar', raiz).addEventListener('click', fecharModal);
    $('#form-receber', raiz).addEventListener('submit', (e) => {
      e.preventDefault();
      const d = lerForm(e.target);
      DB.salvarItem('servicos', { id, pago: true, dataPagamento: d.dataPagamento, forma: d.forma, previsaoPagamento: '' });
      fecharModal();
      avisar('Pagamento registrado.');
      render();
    });
  });
}

function abaPagar(caixa, lista, fixos, am) {
  const hoje = hojeISO();
  caixa.innerHTML = `
    ${fixos.length ? `<div class="cartao aviso-linha"><span>${fixos.length} gasto(s) fixo(s) de ${nomeMes(am).toLowerCase()} ainda não lançado(s):
      ${fixos.map((f) => esc(f.descricao)).join(', ')}.</span><button class="btn peq" id="lancar-fixos">Lançar como contas a pagar</button></div>` : ''}
    ${lista.length ? `<div class="lista-cartoes">${lista.map((l) => {
      const v = l.vencimento || l.data;
      const quando = v < hoje ? tag('Vencida', 'vermelho') : v === hoje ? tag('Vence hoje', 'laranja') : v <= somarDias(hoje, 3) ? tag('Vence logo', 'amarelo') : '';
      return `<div class="item-lista" data-lanc="${l.id}"><div class="item-info"><b>${esc(l.descricao || l.categoria)}</b>
        <small>Vencimento ${dataBR(v)} · ${esc(l.categoria || '')}</small><div class="tags">${quando}</div>
        <div class="acoes" style="margin-top:6px"><button class="btn peq" data-paguei="${l.id}">Paguei</button></div></div>
        <div class="item-valor">${moeda(l.valor)}</div></div>`;
    }).join('')}</div>` : '<div class="cartao vazio">Nenhuma conta a pagar.</div>'}
    <p class="ajuda">Gastos que se repetem todo mês (DAS do MEI, celular, parcela de equipamento...) podem ser cadastrados em
      <a href="#" id="ir-config">Configurações → Gastos fixos</a>.</p>`;
  if ($('#lancar-fixos', caixa)) {
    $('#lancar-fixos', caixa).addEventListener('click', () => {
      fixos.forEach((f) => {
        const [a, m] = am.split('-').map(Number);
        const dia = Math.min(Number(f.dia) || 10, new Date(a, m, 0).getDate());
        const venc = `${am}-${String(dia).padStart(2, '0')}`;
        DB.salvarItem('lancamentos', { tipo: 'gasto', fixoId: f.id, mesFixo: am, descricao: f.descricao, categoria: f.categoria || 'Outros',
          valor: Number(f.valor) || 0, data: venc, vencimento: venc, pago: false, forma: 'Pix' });
      });
      avisar('Gastos fixos lançados.');
      render();
    });
  }
  $('#ir-config', caixa).addEventListener('click', (e) => { e.preventDefault(); irPara('config'); });
  caixa.addEventListener('click', (e) => {
    const p = e.target.closest('[data-paguei]');
    if (p) {
      const l = DB.obter('lancamentos', p.dataset.paguei);
      if (!Number(l.valor)) { formLancamento(l.id); avisar('Informe o valor da conta e marque "Já está pago".'); return; }
      DB.salvarItem('lancamentos', { id: l.id, pago: true, data: hojeISO() });
      avisar('Conta paga.');
      render();
      return;
    }
    const item = e.target.closest('[data-lanc]');
    if (item) formLancamento(item.dataset.lanc);
  });
}

function resumoAno(caixa, ano) {
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
  const linhas = meses.map((m) => ({ m, e: somar(entradasDoMes(m)), g: somar(gastosDoMes(m)) }));
  const totE = linhas.reduce((t, l) => t + l.e, 0), totG = linhas.reduce((t, l) => t + l.g, 0);
  // Faturamento do MEI: serviços feitos no ano (recebidos ou não) + outras entradas de serviço/venda.
  const faturamento = DB.listar('servicos').filter((s) => String(s.data || '').startsWith(ano)).reduce((t, s) => t + valorServico(s), 0)
    + DB.listar('lancamentos').filter((l) => l.tipo === 'entrada' && String(l.data || '').startsWith(ano) && ['Serviço avulso', 'Venda de material'].includes(l.categoria))
      .reduce((t, l) => t + (Number(l.valor) || 0), 0);
  const limite = Number(DB.config().limiteMei) || 0;
  const pct = limite ? Math.min(100, (faturamento / limite) * 100) : 0;
  caixa.innerHTML = `
    ${limite ? `<div class="cartao"><h3>Limite do MEI em ${ano}</h3>
      <div class="progresso"><span style="width:${pct}%" class="${pct >= 90 ? 'perigo' : pct >= 75 ? 'atencao' : ''}"></span></div>
      <p>Faturado: <b>${moeda(faturamento)}</b> de ${moeda(limite)} (${pct.toFixed(0)}%). Ainda cabe: <b>${moeda(Math.max(0, limite - faturamento))}</b>.</p>
      <p class="ajuda">Conta o valor de todos os serviços do ano (recebidos ou não). O limite pode ser mudado em Configurações (deixe em branco para esconder).</p></div>` : ''}
    <div class="cartao" style="padding:0"><div class="tabela-wrap"><table>
      <thead><tr><th>Mês</th><th class="num">Entrou</th><th class="num">Gastos</th><th class="num">Lucro</th></tr></thead>
      <tbody>${linhas.map((l) => `<tr><td>${MESES[Number(l.m.slice(5)) - 1]}</td><td class="num">${moeda(l.e)}</td><td class="num">${moeda(l.g)}</td>
        <td class="num ${l.e - l.g < 0 ? 'texto-vermelho' : ''}">${moeda(l.e - l.g)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th>Total ${ano}</th><th class="num">${moeda(totE)}</th><th class="num">${moeda(totG)}</th><th class="num">${moeda(totE - totG)}</th></tr></tfoot>
    </table></div></div>`;
}
