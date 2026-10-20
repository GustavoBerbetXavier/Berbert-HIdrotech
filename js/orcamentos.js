// Orçamentos: itens e valores, PDF pelo WhatsApp e, quando o cliente aprova, vira serviço.

const SITUACOES_ORC = [['pendente', 'Aguardando', 'amarelo'], ['aprovado', 'Aprovado', 'verde'], ['recusado', 'Recusado', 'cinza']];
const totalOrcamento = (o) => Math.max(0, subtotalItens(o.itens) - (Number(o.desconto) || 0));
function tagOrcamento(o) {
  const [, r, cor] = SITUACOES_ORC.find(([v]) => v === o.status) || SITUACOES_ORC[0];
  return tag(r, cor);
}
let padraoNovoOrc = {};
function novoOrcamento(padrao = {}) {
  padraoNovoOrc = padrao;
  irPara('orcamento/novo');
}

function orcamentos(el) {
  const est = estado('orcamentos', { aba: 'pendente' });
  const todos = DB.listar('orcamentos');
  const abas = [['pendente', 'Aguardando'], ['aprovado', 'Aprovados'], ['recusado', 'Recusados'], ['todos', 'Todos']];
  const lista = todos.filter((o) => est.aba === 'todos' || (o.status || 'pendente') === est.aba)
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.numero - a.numero);
  el.innerHTML = `
    <div class="cabecalho"><h2>Orçamentos</h2><button class="btn" id="novo">+ Novo orçamento</button></div>
    <div class="abas">${abas.map(([v, r]) => `<button class="aba ${est.aba === v ? 'ativa' : ''}" data-aba="${v}">${r}
      <span class="cont">${todos.filter((o) => v === 'todos' || (o.status || 'pendente') === v).length}</span></button>`).join('')}</div>
    ${lista.length ? `<div class="lista-cartoes">${lista.map((o) => {
      const vencido = o.status === 'pendente' && o.validadeDias && somarDias(o.data, o.validadeDias) < hojeISO();
      return `<div class="item-lista" data-orc="${o.id}"><div class="item-info"><b>${esc(nomeCliente(o.clienteId))}</b>
        <small>nº ${o.numero} · ${dataBR(o.data)}${o.descricao ? ' · ' + esc(o.descricao.slice(0, 60)) : ''}</small>
        <div class="tags">${tagOrcamento(o)} ${vencido ? tag('Validade vencida', 'vermelho') : ''}</div></div>
        <div class="item-valor">${moeda(totalOrcamento(o))}</div></div>`;
    }).join('')}</div>` : '<div class="cartao vazio">Nenhum orçamento aqui.</div>'}`;
  $('#novo', el).addEventListener('click', () => novoOrcamento());
  $('.abas', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-aba]');
    if (b) { est.aba = b.dataset.aba; render(); }
  });
  el.addEventListener('click', (e) => {
    const item = e.target.closest('[data-orc]');
    if (item) irPara('orcamento/' + item.dataset.orc);
  });
}

function paginaOrcamento(el, id) {
  const novo = id === 'novo';
  const o = novo ? null : DB.obter('orcamentos', id);
  if (!novo && !o) {
    el.innerHTML = '<div class="cartao"><p>Orçamento não encontrado.</p><button class="btn sec" id="voltar">Voltar</button></div>';
    $('#voltar', el).addEventListener('click', () => irPara('orcamentos'));
    return;
  }
  const cfg = DB.config();
  const x = o || { data: hojeISO(), validadeDias: 15, status: 'pendente', itens: [{ quantidade: 1 }],
    garantiaDias: Number(cfg.garantiaPadrao ?? 30), pagamento: cfg.condicoesPagamento || 'Pix, dinheiro ou cartão.', ...padraoNovoOrc };
  padraoNovoOrc = {};
  const orcId = o ? o.id : DB.novoId();
  const tabela = cfg.tabelaPrecos || [];
  let sujo = false;
  el.innerHTML = `
    <div class="pagina-topo"><button class="btn sec peq" id="voltar">&lsaquo; Orçamentos</button>
      <h2>${o ? `Orçamento nº ${o.numero}` : 'Novo orçamento'}</h2>${o ? tagOrcamento(o) : ''}</div>
    ${o ? `<div class="cartao barra-docs"><div class="acoes">
      <button class="btn" id="whats">Enviar pelo WhatsApp</button>
      <button class="btn sec" id="imprimir">Imprimir / PDF</button>
      ${o.status !== 'aprovado' ? '<button class="btn sec" id="aprovar">Cliente aprovou: criar serviço</button>' : ''}
      ${o.servicoId && DB.obter('servicos', o.servicoId) ? '<button class="btn sec" id="ver-servico">Ver serviço</button>' : ''}
    </div></div>` : ''}
    <form id="form-orc" class="pagina-form">
      <section class="cartao form">
        ${campoCliente(x.clienteId)}
        ${campo('Data', 'data', x.data, 'date', 'required')}
        ${campo('Validade (dias)', 'validadeDias', x.validadeDias, 'number', 'min="0"')}
        <div class="campo-escolha full"><span>Situação</span>${botoesEscolha('status', SITUACOES_ORC, x.status || 'pendente')}</div>
        ${campo('Descrição do serviço', 'descricao', x.descricao, 'textarea', 'full placeholder="Ex.: desentupimento da rede de esgoto do condomínio com hidrojateamento..."')}
      </section>
      <section class="cartao"><h3>Valores</h3>
        ${tabela.length ? `<label class="campo-linha">Adicionar da tabela de preços<select id="da-tabela"><option value="">— escolher —</option>
          ${tabela.map((t, i) => `<option value="${i}">${esc(t.descricao)} — ${moeda(t.valor)}</option>`).join('')}</select></label>` : ''}
        <div id="itens"></div>
        <button type="button" class="btn sec peq" id="add-item">+ Item</button>
        <div class="form" style="margin-top:12px">
          ${campo('Desconto (R$)', 'desconto', x.desconto, 'dinheiro')}
          <div class="total-servico">Total: <b id="total"></b></div>
          ${campo('Condições de pagamento', 'pagamento', x.pagamento, 'text', 'full')}
          <label>Garantia<select name="garantiaDias">${opcoesSimples(GARANTIAS, x.garantiaDias)}</select></label>
          ${campo('Observações', 'obs', x.obs, 'textarea', 'full')}
        </div>
      </section>
      <div class="barra-salvar">
        ${o ? '<button type="button" class="btn sec perigo-texto" id="excluir">Excluir</button>' : ''}
        <button class="btn" id="salvar">Salvar</button>
      </div>
    </form>`;
  const form = $('#form-orc', el);
  ligarCampoCliente(form, () => (sujo = true));
  const lerItens = () => $$('.item-valor-linha', el).map((tr) => ({
    descricao: $('[data-c=descricao]', tr).value.trim(),
    quantidade: num($('[data-c=quantidade]', tr).value) || 1,
    valor: num($('[data-c=valor]', tr).value),
  }));
  const desenharItens = (lista) => {
    $('#itens', el).innerHTML = lista.map((i) => `<div class="item-valor-linha">
      <input data-c="descricao" placeholder="Descrição" value="${esc(i.descricao || '')}">
      <input data-c="quantidade" inputmode="decimal" title="Quantidade" value="${esc(i.quantidade || 1)}">
      <input data-c="valor" inputmode="decimal" placeholder="Valor" value="${esc(valorCampo(i.valor))}">
      <button type="button" class="btn sec peq" data-tirar-item title="Remover">&times;</button></div>`).join('');
  };
  const atualizarTotal = () => { $('#total', el).textContent = moeda(Math.max(0, subtotalItens(lerItens()) - num(form.desconto.value))); };
  desenharItens(x.itens && x.itens.length ? x.itens : [{ quantidade: 1 }]);
  atualizarTotal();
  $('#add-item', el).addEventListener('click', () => desenharItens([...lerItens(), { quantidade: 1 }]));
  $('#itens', el).addEventListener('click', (e) => {
    if (!e.target.matches('[data-tirar-item]')) return;
    const lista = lerItens();
    lista.splice($$('[data-tirar-item]', el).indexOf(e.target), 1);
    desenharItens(lista.length ? lista : [{ quantidade: 1 }]);
    atualizarTotal();
  });
  if ($('#da-tabela', el)) {
    $('#da-tabela', el).addEventListener('change', (e) => {
      const t = tabela[Number(e.target.value)];
      e.target.value = '';
      if (!t) return;
      desenharItens([...lerItens().filter((i) => i.descricao || i.valor), { descricao: t.descricao, quantidade: 1, valor: t.valor }]);
      atualizarTotal();
      sujo = true;
    });
  }
  form.addEventListener('input', (e) => {
    sujo = true;
    if (e.target.closest('#itens') || e.target.name === 'desconto') atualizarTotal();
  });
  form.addEventListener('change', () => (sujo = true));
  protegerSaida = { sujo: () => sujo, descartar: () => {} };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!clienteValido(form)) return;
    const d = lerForm(form);
    const itens = lerItens().filter((i) => i.descricao || i.valor);
    if (!itens.length) { avisar('Coloque pelo menos um item com valor.', 'erro'); return; }
    DB.salvarItem('orcamentos', {
      id: orcId, numero: o ? o.numero : DB.proximoNumero('orcamentos'),
      clienteId: d.clienteId, data: d.data, validadeDias: Number(d.validadeDias) || 0, status: d.status || 'pendente',
      descricao: d.descricao, itens, desconto: num(d.desconto), pagamento: d.pagamento,
      garantiaDias: Number(d.garantiaDias) || 0, obs: d.obs,
    });
    sujo = false;
    protegerSaida = null;
    avisar('Orçamento salvo.');
    irPara('orcamento/' + orcId, true);
  });
  $('#voltar', el).addEventListener('click', () => irPara('orcamentos'));
  if (!o) return;
  const avisarSujo = () => !sujo || confirmar('Há alterações não salvas. O documento sai com o que já estava salvo. Continuar?');
  $('#imprimir', el).addEventListener('click', () => { if (avisarSujo()) imprimir(documentoOrcamento(DB.obter('orcamentos', orcId))); });
  $('#whats', el).addEventListener('click', (e) => {
    if (!avisarSujo()) return;
    const atual = DB.obter('orcamentos', orcId);
    const cli = DB.obter('clientes', atual.clienteId) || {};
    const msg = `Olá, ${cli.contato || cli.nome || ''}! Segue o orçamento nº ${atual.numero} no valor de ${moeda(totalOrcamento(atual))}. Qualquer dúvida estou à disposição. ${nomeEmpresa()}.`;
    enviarPdfWhatsApp({ html: documentoOrcamento(atual), arquivo: `Orçamento ${atual.numero} - ${cli.nome || 'cliente'}`, mensagem: msg, telefone: cli.telefone, botao: e.target });
  });
  if ($('#aprovar', el)) {
    $('#aprovar', el).addEventListener('click', () => {
      if (sujo) { avisar('Salve o orçamento antes.', 'erro'); return; }
      const atual = DB.obter('orcamentos', orcId);
      novoServico({ clienteId: atual.clienteId, itens: atual.itens.map((i) => ({ ...i })), desconto: atual.desconto,
        garantiaDias: atual.garantiaDias, descricao: atual.descricao, orcamentoId: atual.id });
    });
  }
  if ($('#ver-servico', el)) $('#ver-servico', el).addEventListener('click', () => irPara('servico/' + o.servicoId));
  $('#excluir', el).addEventListener('click', () => {
    if (!confirmar(`Excluir o orçamento nº ${o.numero}?`)) return;
    DB.remover('orcamentos', orcId);
    protegerSaida = null;
    irPara('orcamentos', true);
  });
}
