// Clientes: cadastro simples, busca, página do cliente com histórico de serviços,
// botões de ligar, WhatsApp e abrir o endereço no mapa.

const TIPOS_CLIENTE = ['Residência', 'Comércio', 'Condomínio', 'Restaurante / lanchonete', 'Indústria', 'Escola / órgão público', 'Imobiliária', 'Outro'];

function nomeCliente(id) {
  const c = DB.obter('clientes', id);
  return c ? c.nome : '—';
}
const enderecoCliente = (c) => (c ? [c.endereco, c.bairro, c.cidade].filter(Boolean).join(', ') : '');
const linkMapa = (c) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.endereco, c.bairro, c.cidade].filter(Boolean).join(', '))}`;
function botoesContato(c, peq = true) {
  if (!c) return '';
  const fone = extrairTelefones(c.telefone)[0];
  const p = peq ? 'peq' : '';
  return `<div class="acoes">
    ${fone ? `<a class="btn sec ${p}" href="tel:${fone.numero}">Ligar</a>
      <a class="btn sec ${p} whats" href="${linkWhats(fone.numero, `Olá, ${c.contato || c.nome}! Aqui é da ${nomeEmpresa()}.`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
    ${c.endereco ? `<a class="btn sec ${p}" href="${linkMapa(c)}" target="_blank" rel="noopener">Mapa</a>` : ''}
  </div>`;
}

/* ---------- Campo para escolher o cliente ---------- */
// Digita parte do nome, telefone, endereço ou CPF/CNPJ e escolhe na lista. O botão "+ Novo" cadastra na hora.
function campoCliente(selecionado, { obrigatorio = true } = {}) {
  const c = DB.obter('clientes', selecionado);
  return `<label class="full">Cliente${obrigatorio ? ' *' : ''}<div class="linha-cliente">
    <div class="busca-cliente" data-obrigatorio="${obrigatorio ? 1 : ''}">
      <input type="text" class="bc-texto" value="${esc(c ? c.nome : '')}" placeholder="Digite nome, telefone ou endereço..." autocomplete="off">
      <input type="hidden" name="clienteId" value="${c ? c.id : ''}">
      <div class="bc-lista" hidden></div>
    </div><button type="button" class="btn sec" data-novo-cliente>+ Novo</button></div></label>`;
}
function ligarCampoCliente(raiz, aoEscolher = () => {}) {
  const caixa = $('.busca-cliente', raiz);
  if (!caixa) return;
  const texto = $('.bc-texto', caixa), oculto = $('[name=clienteId]', caixa), lista = $('.bc-lista', caixa);
  let resultados = [], ativo = -1;
  const desenhar = () => {
    lista.innerHTML = resultados.length ? resultados.map((c, i) => `<button type="button" data-id="${c.id}" class="${i === ativo ? 'ativo' : ''}">
        <b>${esc(c.nome)}</b><small>${esc([c.telefone, c.endereco, c.bairro].filter(Boolean).join(' · '))}</small></button>`).join('')
      : `<div class="bc-vazio">Nenhum cliente encontrado. Use o botão "+ Novo".</div>`;
    lista.hidden = false;
  };
  const buscar = () => {
    const termos = normalizar(texto.value).split(' ').filter(Boolean).map((t) => (/^[\d().\-\/]+$/.test(t) ? digitos(t) || t : t));
    resultados = DB.listar('clientes')
      .filter((c) => { const b = buscaCliente(c); return termos.every((t) => b.includes(t)); })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).slice(0, 30);
    ativo = resultados.length ? 0 : -1;
    desenhar();
  };
  const escolher = (c) => {
    oculto.value = c.id;
    texto.value = c.nome;
    lista.hidden = true;
    caixa.classList.remove('invalido');
    aoEscolher(c);
  };
  texto.addEventListener('input', () => { oculto.value = ''; buscar(); });
  texto.addEventListener('focus', () => { if (!oculto.value) buscar(); });
  texto.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); ativo = Math.min(ativo + 1, resultados.length - 1); desenhar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = Math.max(ativo - 1, 0); desenhar(); }
    else if (e.key === 'Enter' && !lista.hidden && resultados[ativo]) { e.preventDefault(); escolher(resultados[ativo]); }
    else if (e.key === 'Escape') lista.hidden = true;
  });
  lista.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    e.preventDefault();
    escolher(DB.obter('clientes', b.dataset.id));
  });
  texto.addEventListener('blur', () => setTimeout(() => { lista.hidden = true; }, 150));
  $('[data-novo-cliente]', raiz).addEventListener('click', () => formCliente(null, escolher, texto.value));
}
function clienteValido(form) {
  const caixa = $('.busca-cliente', form);
  if (!caixa || !caixa.dataset.obrigatorio || $('[name=clienteId]', caixa).value) return true;
  caixa.classList.add('invalido');
  $('.bc-texto', caixa).focus();
  avisar('Escolha o cliente na lista ou toque em "+ Novo" para cadastrar.', 'erro');
  return false;
}
const buscaCliente = (c) => [normalizar(c.nome), normalizar(c.contato), digitos(c.telefone), digitos(c.documento),
  normalizar(c.endereco), normalizar(c.bairro), normalizar(c.cidade)].join(' ');

/* ---------- Lista ---------- */
function clientes(el) {
  const est = estado('clientes', { busca: '', tipo: '' });
  el.innerHTML = `
    <div class="cabecalho"><h2>Clientes</h2><button class="btn" id="novo">+ Novo cliente</button></div>
    <div class="filtros">
      <label class="filtro-busca">Buscar<input class="busca" id="busca" placeholder="Nome, telefone, endereço..." value="${esc(est.busca)}"></label>
      <label>Tipo<select id="tipo"><option value="">Todos</option>${opcoesSimples(TIPOS_CLIENTE, est.tipo)}</select></label>
    </div>
    <div id="lista"></div>`;
  const desenhar = () => {
    const termos = normalizar(est.busca).split(' ').filter(Boolean).map((t) => (/^[\d().\-\/]+$/.test(t) ? digitos(t) || t : t));
    const servicos = DB.listar('servicos');
    const ultimo = new Map();
    servicos.forEach((s) => { if (!ultimo.has(s.clienteId) || ultimo.get(s.clienteId) < s.data) ultimo.set(s.clienteId, s.data); });
    const lista = DB.listar('clientes')
      .filter((c) => (!est.tipo || c.tipo === est.tipo) && termos.every((t) => buscaCliente(c).includes(t)))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const mostrar = lista.slice(0, 200);
    $('#lista', el).innerHTML = lista.length ? `<div class="lista-cartoes">${mostrar.map((c) => `
      <div class="item-lista" data-abrir="${c.id}">
        <div class="item-info"><b>${esc(c.nome)}</b>
          <small>${esc([c.tipo, c.telefone].filter(Boolean).join(' · '))}</small>
          <small>${esc(enderecoCliente(c))}</small>
          ${ultimo.has(c.id) ? `<small>Último serviço: ${dataBR(ultimo.get(c.id))}</small>` : ''}</div>
        ${botoesContato(c)}
      </div>`).join('')}</div>
      ${lista.length > mostrar.length ? `<p class="ajuda" style="text-align:center">Mostrando 200 de ${lista.length}. Use a busca para achar os outros.</p>` : ''}`
      : `<div class="cartao vazio">${DB.listar('clientes').length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</div>`;
  };
  desenhar();
  $('#busca', el).addEventListener('input', (e) => { est.busca = e.target.value; desenhar(); });
  $('#tipo', el).addEventListener('change', (e) => { est.tipo = e.target.value; desenhar(); });
  $('#novo', el).addEventListener('click', () => formCliente(null, (c) => irPara('cliente/' + c.id)));
  $('#lista', el).addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const item = e.target.closest('[data-abrir]');
    if (item) irPara('cliente/' + item.dataset.abrir);
  });
}

/* ---------- Formulário ---------- */
function formCliente(id, aoSalvar, nomeInicial = '') {
  const c = DB.obter('clientes', id) || { nome: nomeInicial, tipo: 'Residência', cidade: DB.config().cidadePadrao || '' };
  abrirModal(id ? 'Editar cliente' : 'Novo cliente', `
    <form class="form" id="form-cliente">
      ${campo('Nome *', 'nome', c.nome, 'text', 'full required')}
      ${campo('Telefone / WhatsApp', 'telefone', c.telefone, 'tel')}
      <label>Tipo<select name="tipo">${opcoesSimples(TIPOS_CLIENTE, c.tipo)}</select></label>
      ${campo('Endereço (rua e número)', 'endereco', c.endereco, 'text', 'full')}
      ${campo('Bairro', 'bairro', c.bairro)}
      ${campo('Cidade', 'cidade', c.cidade)}
      ${campo('Ponto de referência', 'referencia', c.referencia, 'text', 'full')}
      <details class="full mais-dados" ${c.documento || c.contato || c.email ? 'open' : ''}><summary>Mais dados (opcional)</summary>
        <div class="form">
          ${campo('CPF / CNPJ', 'documento', c.documento)}
          ${campo('Pessoa de contato / síndico', 'contato', c.contato)}
          ${campo('E-mail', 'email', c.email, 'email', 'full')}
        </div></details>
      ${campo('Observações', 'obs', c.obs, 'textarea', 'full')}
      <div class="form-acoes"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn">Salvar</button></div>
    </form>`, (raiz) => {
    $('#cancelar', raiz).addEventListener('click', fecharModal);
    $('#form-cliente', raiz).addEventListener('submit', (e) => {
      e.preventDefault();
      const d = lerForm(e.target);
      const fone = digitos(d.telefone);
      const repetido = fone.length >= 8 && DB.listar('clientes').find((x) => x.id !== id && digitos(x.telefone).endsWith(fone.slice(-8)));
      if (repetido && !confirmar(`Já existe um cliente com este telefone: ${repetido.nome}. Cadastrar mesmo assim?`)) return;
      const salvo = DB.salvarItem('clientes', { ...(id ? { id } : {}), ...d });
      fecharModal();
      avisar('Cliente salvo.');
      if (aoSalvar) aoSalvar(salvo); else render();
    });
  });
}

/* ---------- Página do cliente ---------- */
function paginaCliente(el, id) {
  const c = DB.obter('clientes', id);
  if (!c) {
    el.innerHTML = '<div class="cartao"><p>Cliente não encontrado.</p><button class="btn sec" id="voltar">Voltar</button></div>';
    $('#voltar', el).addEventListener('click', () => irPara('clientes'));
    return;
  }
  const servicos = DB.listar('servicos').filter((s) => s.clienteId === id).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const orcs = DB.listar('orcamentos').filter((o) => o.clienteId === id).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const total = servicos.reduce((s, x) => s + valorServico(x), 0);
  const aReceber = servicos.filter((s) => !s.pago).reduce((s, x) => s + valorServico(x), 0);
  const garantia = garantiaVigente(id);
  el.innerHTML = `
    <div class="pagina-topo"><button class="btn sec peq" id="voltar">&lsaquo; Clientes</button><h2>${esc(c.nome)}</h2></div>
    <div class="cartao">
      <div class="dados-cliente">
        ${c.tipo ? `<div>${tag(c.tipo, 'azul')}</div>` : ''}
        ${c.telefone ? `<div><span>Telefone</span><b>${esc(c.telefone)}</b></div>` : ''}
        ${c.endereco || c.bairro ? `<div><span>Endereço</span><b>${esc(enderecoCliente(c))}</b></div>` : ''}
        ${c.referencia ? `<div><span>Referência</span><b>${esc(c.referencia)}</b></div>` : ''}
        ${c.contato ? `<div><span>Contato</span><b>${esc(c.contato)}</b></div>` : ''}
        ${c.documento ? `<div><span>CPF / CNPJ</span><b>${esc(c.documento)}</b></div>` : ''}
        ${c.email ? `<div><span>E-mail</span><b>${esc(c.email)}</b></div>` : ''}
        ${c.obs ? `<div class="full"><span>Observações</span><b style="white-space:pre-line">${esc(c.obs)}</b></div>` : ''}
      </div>
      <div class="acoes" style="margin-top:12px">${botoesContato(c, false)}
        <button class="btn sec" id="editar">Editar</button></div>
    </div>
    ${garantia ? `<div class="cartao aviso-linha">Serviço nº ${garantia.numero} de ${dataBR(garantia.data)} está na <b>garantia até ${dataBR(fimGarantia(garantia))}</b>.</div>` : ''}
    <div class="grade-kpi">
      <div class="kpi"><div class="rotulo">Serviços feitos</div><div class="valor">${servicos.length}</div></div>
      <div class="kpi"><div class="rotulo">Total em serviços</div><div class="valor">${moeda(total)}</div></div>
      <div class="kpi"><div class="rotulo">A receber</div><div class="valor ${aReceber ? 'texto-vermelho' : ''}">${moeda(aReceber)}</div></div>
    </div>
    <div class="cabecalho"><h3 style="margin:0">Serviços</h3><div class="acoes">
      <button class="btn" id="novo-servico">+ Novo serviço</button><button class="btn sec" id="novo-orc">+ Orçamento</button></div></div>
    ${servicos.length ? listaServicosHTML(servicos, false) : '<div class="cartao vazio">Nenhum serviço para este cliente.</div>'}
    ${orcs.length ? `<h3>Orçamentos</h3><div class="lista-cartoes">${orcs.map((o) => `<div class="item-lista" data-orc="${o.id}">
      <div class="item-info"><b>Orçamento nº ${o.numero}</b><small>${dataBR(o.data)} · ${moeda(totalOrcamento(o))}</small></div>${tagOrcamento(o)}</div>`).join('')}</div>` : ''}
    <div style="margin-top:24px"><button class="btn sec peq perigo-texto" id="excluir">Excluir cliente</button></div>`;
  $('#voltar', el).addEventListener('click', () => irPara('clientes'));
  $('#editar', el).addEventListener('click', () => formCliente(id));
  $('#novo-servico', el).addEventListener('click', () => novoServico({ clienteId: id }));
  $('#novo-orc', el).addEventListener('click', () => novoOrcamento({ clienteId: id }));
  ligarListaServicos(el);
  el.addEventListener('click', (e) => {
    const o = e.target.closest('[data-orc]');
    if (o) irPara('orcamento/' + o.dataset.orc);
  });
  $('#excluir', el).addEventListener('click', () => {
    if (servicos.length || orcs.length) { avisar('Este cliente tem serviços ou orçamentos. Exclua-os antes de excluir o cliente.', 'erro'); return; }
    if (!confirmar(`Excluir o cliente ${c.nome}?`)) return;
    DB.remover('clientes', id);
    avisar('Cliente excluído.');
    irPara('clientes', true);
  });
}
