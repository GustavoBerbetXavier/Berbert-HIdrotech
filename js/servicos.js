// Serviços: cada atendimento é um serviço, com o que foi feito, o diagnóstico, as fotos,
// a garantia, o valor e o pagamento. Dele saem o laudo e o recibo em PDF.
// Situações: "Em execução" e "Concluído".

const TIPOS_SERVICO = ['Desentupimento de pia', 'Desentupimento de vaso sanitário', 'Desentupimento de ralo',
  'Desentupimento de tanque', 'Desentupimento de mictório', 'Desentupimento de rede de esgoto',
  'Desentupimento de caixa de inspeção', 'Desentupimento de coluna (prédio)', 'Desentupimento de rede pluvial / calha',
  'Limpeza de caixa de gordura', 'Limpeza de fossa / sumidouro', 'Hidrojateamento', 'Inspeção com câmera',
  'Caça-vazamento', 'Reparo hidráulico'];
const LOCAIS_SERVICO = ['Cozinha', 'Banheiro', 'Área de serviço / lavanderia', 'Quintal / área externa', 'Garagem',
  'Calçada / rua', 'Área comum (condomínio)', 'Loja / salão', 'Cozinha industrial'];
const CAUSAS = ['Acúmulo de gordura', 'Resíduos de alimentos', 'Cabelo', 'Papel higiênico / lenço umedecido',
  'Absorvente / fralda / preservativo', 'Objeto estranho', 'Raízes de árvore', 'Areia / terra / entulho',
  'Calcificação / incrustação', 'Tubulação quebrada ou amassada', 'Caimento errado da tubulação',
  'Tubulação subdimensionada', 'Caixa de gordura saturada', 'Fossa cheia'];
const EQUIPAMENTOS = ['Máquina rotativa (cabo / mola)', 'Hidrojateadora (alta pressão)', 'Sonda / mola manual',
  'Desentupidor a ar comprimido', 'Ventosa / bomba manual', 'Caminhão de sucção (vácuo)', 'Câmera de inspeção',
  'Detector de vazamento (geofone)'];
const REALIZADOS = ['Desobstrução mecânica da tubulação', 'Hidrojateamento da tubulação', 'Remoção manual dos resíduos',
  'Limpeza e sucção da caixa de gordura', 'Esgotamento da fossa / sumidouro', 'Limpeza da caixa de inspeção',
  'Inspeção por câmera após o serviço', 'Teste de escoamento com água (aprovado)'];
const RECOMENDACOES = ['Não jogar óleo ou gordura na pia.',
  'Não jogar papel higiênico, lenço umedecido, absorvente ou fralda no vaso sanitário.',
  'Usar ralo com tela / peneira na pia e no box.',
  'Limpar a caixa de gordura periodicamente (a cada 3 a 6 meses).',
  'Fazer manutenção preventiva da rede de esgoto.',
  'Trocar o trecho de tubulação danificado.',
  'Instalar caixa de inspeção / caixa de gordura adequada.'];
const GARANTIAS = [[0, 'Sem garantia'], [7, '7 dias'], [15, '15 dias'], [30, '30 dias'], [60, '60 dias'], [90, '90 dias'], [180, '6 meses']];
const RETORNOS = [[0, 'Não'], [1, '1 mês'], [2, '2 meses'], [3, '3 meses'], [4, '4 meses'], [6, '6 meses'], [12, '1 ano']];
const FORMAS_PAGAMENTO = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Cheque'];
const SITUACOES = [['execucao', 'Em execução', 'azul'], ['concluido', 'Concluído', 'verde']];
const ETAPAS_FOTO = [['antes', 'Antes'], ['durante', 'Durante'], ['depois', 'Depois']];

/* ---------- Cálculos ---------- */
const subtotalItens = (itens) => (itens || []).reduce((s, i) => s + (Number(i.quantidade) || 1) * (Number(i.valor) || 0), 0);
const valorServico = (s) => Math.max(0, subtotalItens(s.itens) - (Number(s.desconto) || 0));
const gastosDoServico = (id) => DB.listar('lancamentos').filter((l) => l.tipo === 'gasto' && l.servicoId === id);
const fimGarantia = (s) => (s.garantiaDias ? somarDias(s.dataConclusao || s.data, s.garantiaDias) : '');
const resumoServico = (s) => (s.tipos || []).join(', ') || s.problema || 'Serviço';
// Serviço concluído do cliente ainda dentro da garantia (o mais recente).
function garantiaVigente(clienteId, excetoId) {
  const hoje = hojeISO();
  return DB.listar('servicos')
    .filter((s) => s.clienteId === clienteId && s.id !== excetoId && s.status === 'concluido' && s.garantiaDias && fimGarantia(s) >= hoje)
    .sort((a, b) => fimGarantia(b).localeCompare(fimGarantia(a)))[0] || null;
}
function tagSituacao(s) {
  const [, rotulo, cor] = SITUACOES.find(([v]) => v === s.status) || SITUACOES[0];
  return tag(rotulo, cor);
}
function tagPagamento(s) {
  if (!valorServico(s)) return '';
  return s.pago ? tag('Pago', 'verde') : tag('A receber', 'vermelho');
}

/* ---------- Lista ---------- */
function listaServicosHTML(lista, mostrarCliente = true) {
  return `<div class="lista-cartoes">${lista.map((s) => `<div class="item-lista" data-servico="${s.id}">
    <div class="item-info"><b>${mostrarCliente ? esc(nomeCliente(s.clienteId)) : `Serviço nº ${s.numero}`}</b>
      <small>${mostrarCliente ? `nº ${s.numero} · ` : ''}${dataBR(s.data)} · ${esc(resumoServico(s))}</small>
      <div class="tags">${tagSituacao(s)} ${tagPagamento(s)} ${(s.fotos || []).length ? tag(`${s.fotos.length} foto(s)`, 'cinza') : ''}</div></div>
    <div class="item-valor">${valorServico(s) ? moeda(valorServico(s)) : ''}</div>
  </div>`).join('')}</div>`;
}
function ligarListaServicos(el) {
  el.addEventListener('click', (e) => {
    const item = e.target.closest('[data-servico]');
    if (item && !e.target.closest('a, button')) irPara('servico/' + item.dataset.servico);
  });
}

function servicos(el) {
  const est = estado('servicos', { aba: 'execucao', busca: '' });
  const todos = DB.listar('servicos');
  const filtros = {
    execucao: (s) => s.status !== 'concluido',
    concluido: (s) => s.status === 'concluido',
    receber: (s) => !s.pago && valorServico(s) > 0,
    todos: () => true,
  };
  const abas = [['execucao', 'Em execução'], ['concluido', 'Concluídos'], ['receber', 'A receber'], ['todos', 'Todos']];
  el.innerHTML = `
    <div class="cabecalho"><h2>Serviços</h2><button class="btn" id="novo">+ Novo serviço</button></div>
    <div class="abas">${abas.map(([v, r]) => `<button class="aba ${est.aba === v ? 'ativa' : ''}" data-aba="${v}">${r}
      <span class="cont">${todos.filter(filtros[v]).length}</span></button>`).join('')}</div>
    <div class="filtros"><label class="filtro-busca">Buscar<input class="busca" id="busca" placeholder="Cliente, número, serviço..." value="${esc(est.busca)}"></label></div>
    <div id="lista"></div>`;
  const desenhar = () => {
    const termos = normalizar(est.busca).split(' ').filter(Boolean);
    const lista = todos.filter(filtros[est.aba])
      .filter((s) => { const b = normalizar(`${s.numero} ${nomeCliente(s.clienteId)} ${resumoServico(s)} ${s.problema || ''}`); return termos.every((t) => b.includes(t)); })
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.numero - a.numero);
    const mostrar = lista.slice(0, 150);
    const total = lista.reduce((s, x) => s + valorServico(x), 0);
    $('#lista', el).innerHTML = lista.length
      ? `${est.aba === 'receber' ? `<div class="cartao aviso-linha">Total a receber: <b>${moeda(total)}</b></div>` : ''}${listaServicosHTML(mostrar)}
        ${lista.length > mostrar.length ? `<p class="ajuda" style="text-align:center">Mostrando 150 de ${lista.length}. Use a busca.</p>` : ''}`
      : '<div class="cartao vazio">Nenhum serviço aqui.</div>';
  };
  desenhar();
  $('.abas', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-aba]');
    if (b) { est.aba = b.dataset.aba; render(); }
  });
  $('#busca', el).addEventListener('input', (e) => { est.busca = e.target.value; desenhar(); });
  $('#novo', el).addEventListener('click', () => novoServico());
  ligarListaServicos($('#lista', el));
}

/* ---------- Página do serviço ---------- */
let padraoNovoServico = {};
function novoServico(padrao = {}) {
  padraoNovoServico = padrao;
  irPara('servico/novo');
}
// Endereços das fotos já pedidos (valem 1 hora; renova antes disso).
const cacheUrls = new Map();
async function urlsFotos(caminhos) {
  const agora = Date.now();
  const faltam = caminhos.filter((c) => !cacheUrls.has(c) || agora - cacheUrls.get(c).em > 50 * 60 * 1000);
  if (faltam.length) {
    const novas = await DB.urlsFotos(faltam);
    Object.entries(novas).forEach(([c, url]) => cacheUrls.set(c, { url, em: agora }));
  }
  return Object.fromEntries(caminhos.filter((c) => cacheUrls.has(c)).map((c) => [c, cacheUrls.get(c).url]));
}

function paginaServico(el, id) {
  const novo = id === 'novo';
  const s = novo ? null : DB.obter('servicos', id);
  if (!novo && !s) {
    el.innerHTML = '<div class="cartao"><p>Serviço não encontrado.</p><button class="btn sec" id="voltar">Voltar</button></div>';
    $('#voltar', el).addEventListener('click', () => irPara('servicos'));
    return;
  }
  const cfg = DB.config();
  const padrao = novo ? padraoNovoServico : {};
  padraoNovoServico = {};
  const servicoId = s ? s.id : DB.novoId();
  // Novo serviço para um cliente que já tem retorno marcado: repete o prazo.
  const anterior = padrao.clienteId && DB.listar('servicos').filter((x) => x.clienteId === padrao.clienteId)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0];
  const x = s || {
    data: hojeISO(), status: 'execucao', itens: padrao.itens || [{ descricao: '', quantidade: 1, valor: '' }],
    garantiaDias: Number(cfg.garantiaPadrao ?? 30), retornoMeses: anterior ? anterior.retornoMeses || 0 : 0,
    recomendacoes: [], forma: 'Pix', ...padrao,
  };
  const fotos = (x.fotos || []).map((f) => ({ ...f }));
  const enviadasAgora = [];
  const removidas = [];
  let enviandoFotos = 0;
  let assinatura = x.assinatura || '';
  let sujo = false;

  const tabela = cfg.tabelaPrecos || [];
  el.innerHTML = `
    <div class="pagina-topo"><button class="btn sec peq" id="voltar">&lsaquo; Serviços</button>
      <h2>${s ? `Serviço nº ${s.numero}` : 'Novo serviço'}</h2>${s ? tagSituacao(s) : ''}</div>
    ${s ? `<div class="cartao barra-docs"><div class="acoes">
      <button class="btn" data-doc="laudo-whats">Laudo pelo WhatsApp</button>
      <button class="btn sec" data-doc="laudo">Laudo (imprimir / PDF)</button>
      ${valorServico(s) ? `<button class="btn sec" data-doc="recibo-whats">Recibo pelo WhatsApp</button>
      <button class="btn sec" data-doc="recibo">Recibo (imprimir / PDF)</button>` : ''}
    </div></div>` : ''}
    <form id="form-servico" class="pagina-form">
      <section class="cartao form">
        ${campoCliente(x.clienteId)}
        <div class="full" id="aviso-garantia"></div>
        ${campo('Data', 'data', x.data, 'date', 'required')}
        <div class="campo-escolha"><span>Situação</span>${botoesEscolha('status', SITUACOES, x.status)}</div>
      </section>

      <section class="cartao"><h3>Serviço</h3>
        <div class="secao-form"><b>O que foi feito</b>${grupoMarcar('tipos', TIPOS_SERVICO, x.tipos)}</div>
        <div class="secao-form"><b>Local</b>${grupoMarcar('locais', LOCAIS_SERVICO, x.locais)}</div>
        <div class="form">${campo('Problema relatado pelo cliente', 'problema', x.problema, 'textarea', 'full placeholder="Ex.: pia da cozinha não escoa, água voltando no ralo..."')}</div>
      </section>

      <section class="cartao"><h3>Diagnóstico e procedimento</h3>
        <div class="secao-form"><b>Causa encontrada</b>${grupoMarcar('causas', CAUSAS, x.causas)}</div>
        <div class="secao-form"><b>Equipamentos usados</b>${grupoMarcar('equipamentos', EQUIPAMENTOS, x.equipamentos)}</div>
        <div class="secao-form"><b>Procedimento realizado</b>${grupoMarcar('realizados', REALIZADOS, x.realizados)}</div>
        <div class="form">
          ${campo('Metros de tubulação desobstruídos', 'metragem', x.metragem, 'text', 'inputmode="decimal" placeholder="Ex.: 12"')}
          ${campo('Outro / descrição do serviço', 'descricao', x.descricao, 'textarea', 'full placeholder="Detalhes que vão aparecer no laudo"')}
        </div>
      </section>

      <section class="cartao"><h3>Fotos</h3>
        <p class="ajuda">As fotos vão para o laudo. Precisa de internet para enviar.</p>
        <div class="fotos-etapas tres">${ETAPAS_FOTO.map(([etapa, rotulo]) => `<div>
          <div class="fotos-cab"><b>${rotulo}</b><div class="acoes">
            <label class="btn peq">Câmera<input type="file" accept="image/*" capture="environment" data-etapa="${etapa}" hidden></label>
            <label class="btn sec peq">Galeria<input type="file" accept="image/*" multiple data-etapa="${etapa}" hidden></label></div></div>
          <div class="fotos-grade" data-grade="${etapa}"></div></div>`).join('')}</div>
      </section>

      <section class="cartao"><h3>Garantia e recomendações</h3>
        <div class="form">
          <label>Garantia<select name="garantiaDias">${opcoesSimples(GARANTIAS, x.garantiaDias)}</select></label>
          <label>Manutenção preventiva (avisar o cliente daqui a)<select name="retornoMeses">${opcoesSimples(RETORNOS, x.retornoMeses || 0)}</select></label>
        </div>
        <div class="secao-form" style="margin-top:12px"><b>Recomendações ao cliente</b>${grupoMarcar('recomendacoes', RECOMENDACOES, x.recomendacoes, 'uma-coluna')}</div>
      </section>

      <section class="cartao"><h3>Valor e pagamento</h3>
        ${tabela.length ? `<label class="campo-linha">Adicionar da tabela de preços<select id="da-tabela"><option value="">— escolher —</option>
          ${tabela.map((t, i) => `<option value="${i}">${esc(t.descricao)} — ${moeda(t.valor)}</option>`).join('')}</select></label>` : ''}
        <div id="itens"></div>
        <button type="button" class="btn sec peq" id="add-item">+ Item</button>
        <div class="form" style="margin-top:12px">
          ${campo('Desconto (R$)', 'desconto', x.desconto, 'dinheiro')}
          <div class="total-servico">Total: <b id="total">${moeda(valorServico(x))}</b></div>
          <label>Forma de pagamento<select name="forma">${opcoesSimples(FORMAS_PAGAMENTO, x.forma)}</select></label>
          <label class="check grande-check"><input type="checkbox" name="pago" ${x.pago ? 'checked' : ''}> Já recebi o pagamento</label>
          <div id="campo-pagto" class="full form" style="padding:0">
            ${campo('Data do recebimento', 'dataPagamento', x.dataPagamento || hojeISO(), 'date')}
          </div>
          <div id="campo-receber" class="full form" style="padding:0">
            ${campo('Vai receber em', 'previsaoPagamento', x.previsaoPagamento, 'date')}
          </div>
        </div>
        ${s ? custosServicoHTML(s) : ''}
      </section>

      <section class="cartao"><h3>Assinatura do cliente <small class="ajuda">(opcional)</small></h3>
        <div id="assinatura"></div>
        <div class="form">${campo('Nome de quem assinou', 'assinouNome', x.assinouNome)}</div>
      </section>

      <section class="cartao form">
        ${campo('Anotações internas (não saem no laudo)', 'obs', x.obs, 'textarea', 'full')}
      </section>

      <div class="barra-salvar">
        ${s ? '<button type="button" class="btn sec perigo-texto" id="excluir">Excluir</button>' : ''}
        ${x.status !== 'concluido' ? '<button type="button" class="btn sec" id="concluir">Salvar e concluir</button>' : ''}
        <button class="btn" id="salvar">Salvar</button>
      </div>
    </form>`;
  const form = $('#form-servico', el);

  /* Cliente e garantia */
  const mostrarGarantia = () => {
    const g = form.clienteId.value && garantiaVigente(form.clienteId.value, servicoId);
    $('#aviso-garantia', el).innerHTML = g ? `<div class="aviso-garantia">Atenção: este cliente tem o serviço nº ${g.numero} (${dataBR(g.data)}) <b>na garantia até ${dataBR(fimGarantia(g))}</b>: ${esc(resumoServico(g))}.</div>` : '';
  };
  ligarCampoCliente(form, () => { mostrarGarantia(); sujo = true; });
  mostrarGarantia();

  /* Itens e valores */
  const itens = (x.itens && x.itens.length ? x.itens : [{}]).map((i) => ({ ...i }));
  const lerItens = () => $$('.item-valor-linha', el).map((tr) => ({
    descricao: $('[data-c=descricao]', tr).value.trim(),
    quantidade: num($('[data-c=quantidade]', tr).value) || 1,
    valor: num($('[data-c=valor]', tr).value),
  }));
  const desenharItens = (lista) => {
    $('#itens', el).innerHTML = lista.map((i) => `<div class="item-valor-linha">
      <input data-c="descricao" placeholder="Descrição (ex.: desentupimento de pia)" value="${esc(i.descricao || '')}">
      <input data-c="quantidade" inputmode="decimal" title="Quantidade" value="${esc(i.quantidade || 1)}">
      <input data-c="valor" inputmode="decimal" placeholder="Valor" value="${esc(valorCampo(i.valor))}">
      <button type="button" class="btn sec peq" data-tirar-item title="Remover">&times;</button></div>`).join('');
  };
  const atualizarTotal = () => {
    $('#total', el).textContent = moeda(Math.max(0, subtotalItens(lerItens()) - num(form.desconto.value)));
  };
  desenharItens(itens);
  $('#add-item', el).addEventListener('click', () => { desenharItens([...lerItens(), { quantidade: 1 }]); sujo = true; });
  $('#itens', el).addEventListener('click', (e) => {
    if (!e.target.matches('[data-tirar-item]')) return;
    const lista = lerItens();
    lista.splice($$('[data-tirar-item]', el).indexOf(e.target), 1);
    desenharItens(lista.length ? lista : [{ quantidade: 1 }]);
    atualizarTotal();
    sujo = true;
  });
  if ($('#da-tabela', el)) {
    $('#da-tabela', el).addEventListener('change', (e) => {
      const t = tabela[Number(e.target.value)];
      e.target.value = '';
      if (!t) return;
      const lista = lerItens().filter((i) => i.descricao || i.valor);
      desenharItens([...lista, { descricao: t.descricao, quantidade: 1, valor: t.valor }]);
      atualizarTotal();
      sujo = true;
    });
  }
  form.addEventListener('input', (e) => {
    sujo = true;
    if (e.target.closest('#itens') || e.target.name === 'desconto') atualizarTotal();
  });
  const mostrarPagto = () => {
    $('#campo-pagto', el).hidden = !form.pago.checked;
    $('#campo-receber', el).hidden = form.pago.checked;
  };
  form.pago.addEventListener('change', mostrarPagto);
  form.addEventListener('change', () => (sujo = true));
  mostrarPagto();

  /* Fotos */
  const desenharFotos = () => {
    ETAPAS_FOTO.forEach(([etapa]) => {
      const lista = fotos.filter((f) => f.etapa === etapa);
      $(`[data-grade="${etapa}"]`, el).innerHTML = lista.length ? lista.map((f) => `<figure class="foto-item" data-caminho="${esc(f.caminho)}">
        ${f.url ? `<img src="${esc(f.url)}" alt="">` : '<div class="foto-carregando">Carregando...</div>'}
        <input data-legenda value="${esc(f.legenda || '')}" placeholder="Legenda (opcional)">
        <button type="button" class="btn sec peq" data-tirar-foto>Remover</button></figure>`).join('')
        : '<p class="ajuda">Nenhuma foto.</p>';
    });
  };
  desenharFotos();
  if (fotos.length) {
    urlsFotos(fotos.map((f) => f.caminho)).then((urls) => { fotos.forEach((f) => (f.url = urls[f.caminho] || '')); desenharFotos(); })
      .catch((err) => avisar('Não foi possível mostrar as fotos: ' + err.message, 'erro'));
  }
  el.addEventListener('input', (e) => {
    if (!e.target.matches('[data-legenda]')) return;
    const f = fotos.find((y) => y.caminho === e.target.closest('[data-caminho]').dataset.caminho);
    if (f) f.legenda = e.target.value;
  });
  el.addEventListener('click', (e) => {
    if (!e.target.matches('[data-tirar-foto]')) return;
    const caminho = e.target.closest('[data-caminho]').dataset.caminho;
    const i = fotos.findIndex((f) => f.caminho === caminho);
    if (i >= 0) removidas.push(...fotos.splice(i, 1));
    sujo = true;
    desenharFotos();
  });
  const botaoSalvar = $('#salvar', el);
  $$('[data-etapa]', el).forEach((input) => input.addEventListener('change', async () => {
    const arquivos = [...input.files];
    input.value = '';
    for (const [i, arq] of arquivos.entries()) {
      enviandoFotos++;
      botaoSalvar.disabled = true;
      botaoSalvar.textContent = `Enviando foto ${i + 1} de ${arquivos.length}...`;
      try {
        const blob = await comprimirFoto(arq);
        const caminho = `servicos/${servicoId}/${DB.novoId()}.jpg`;
        await DB.enviarFoto(caminho, blob);
        const f = { caminho, etapa: input.dataset.etapa, legenda: '', url: URL.createObjectURL(blob) };
        fotos.push(f);
        enviadasAgora.push(f);
        sujo = true;
        desenharFotos();
      } catch (err) {
        avisar('A foto não foi enviada: ' + err.message, 'erro');
      } finally {
        enviandoFotos--;
        if (!enviandoFotos) { botaoSalvar.disabled = false; botaoSalvar.textContent = 'Salvar'; }
      }
    }
  }));

  /* Assinatura */
  padAssinatura($('#assinatura', el), assinatura, (img) => { assinatura = img; sujo = true; });

  /* Documentos */
  $$('[data-doc]', el).forEach((b) => b.addEventListener('click', () => {
    if (sujo && !confirmar('Há alterações não salvas. O documento sai com o que já estava salvo. Continuar?')) return;
    const atual = DB.obter('servicos', servicoId);
    const acao = b.dataset.doc;
    if (acao === 'laudo') enviando(b, async () => imprimir(await documentoLaudo(atual)), 'Preparando...');
    if (acao === 'recibo') imprimir(documentoRecibo(atual));
    if (acao === 'laudo-whats') enviarLaudoWhatsApp(atual, b);
    if (acao === 'recibo-whats') enviarReciboWhatsApp(atual, b);
  }));
  ligarCustos(el, s);

  /* Salvar */
  protegerSaida = {
    sujo: () => sujo || enviandoFotos > 0,
    descartar: () => { if (enviadasAgora.length) DB.removerFotos(enviadasAgora.map((f) => f.caminho)).catch(() => {}); },
  };
  const salvar = (concluir) => {
    if (enviandoFotos) { avisar('Aguarde terminar de enviar as fotos.', 'erro'); return; }
    if (!clienteValido(form)) return;
    const d = lerForm(form);
    const status = concluir ? 'concluido' : (d.status || 'execucao');
    const itensLidos = lerItens().filter((i) => i.descricao || i.valor);
    const dados = {
      id: servicoId,
      numero: s ? s.numero : DB.proximoNumero('servicos'),
      clienteId: d.clienteId, data: d.data || hojeISO(), status,
      dataConclusao: status === 'concluido' ? (x.dataConclusao || hojeISO()) : '',
      tipos: lerGrupo(form, 'tipos'), locais: lerGrupo(form, 'locais'), problema: d.problema,
      causas: lerGrupo(form, 'causas'), equipamentos: lerGrupo(form, 'equipamentos'), realizados: lerGrupo(form, 'realizados'),
      metragem: d.metragem, descricao: d.descricao,
      garantiaDias: Number(d.garantiaDias) || 0, retornoMeses: Number(d.retornoMeses) || 0,
      recomendacoes: lerGrupo(form, 'recomendacoes'),
      itens: itensLidos, desconto: num(d.desconto), forma: d.forma, pago: d.pago,
      dataPagamento: d.pago ? (d.dataPagamento || hojeISO()) : '', previsaoPagamento: d.pago ? '' : d.previsaoPagamento,
      assinatura, assinouNome: d.assinouNome, obs: d.obs,
      fotos: fotos.map(({ caminho, etapa, legenda }) => ({ caminho, etapa, legenda: legenda || '' })),
      ...(padrao.orcamentoId ? { orcamentoId: padrao.orcamentoId } : {}),
    };
    if (!dados.tipos.length && !dados.problema && !dados.descricao && !itensLidos.length) {
      avisar('Marque o que foi feito ou escreva o problema.', 'erro');
      return;
    }
    DB.salvarItem('servicos', dados);
    if (removidas.length) DB.removerFotos(removidas.map((f) => f.caminho)).catch(() => {});
    if (padrao.orcamentoId) {
      const o = DB.obter('orcamentos', padrao.orcamentoId);
      if (o) DB.salvarItem('orcamentos', { id: o.id, status: 'aprovado', servicoId });
    }
    sujo = false;
    protegerSaida = null;
    avisar(status === 'concluido' && concluir ? 'Serviço concluído! Agora é só enviar o laudo.' : 'Serviço salvo.');
    irPara('servico/' + servicoId, true);
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); salvar(false); });
  if ($('#concluir', el)) $('#concluir', el).addEventListener('click', () => salvar(true));
  $('#voltar', el).addEventListener('click', () => irPara('servicos'));
  if ($('#excluir', el)) {
    $('#excluir', el).addEventListener('click', () => {
      const gastos = gastosDoServico(servicoId);
      if (!confirmar(`Excluir o serviço nº ${s.numero}?${gastos.length ? ` Os ${gastos.length} gasto(s) ligados a ele continuam no financeiro.` : ''}`)) return;
      DB.remover('servicos', servicoId);
      const caminhos = [...(s.fotos || []), ...enviadasAgora].map((f) => f.caminho);
      if (caminhos.length) DB.removerFotos(caminhos).catch(() => {});
      protegerSaida = null;
      avisar('Serviço excluído.');
      irPara('servicos', true);
    });
  }
}

/* ---------- Custos do serviço (gastos ligados a ele) ---------- */
function custosServicoHTML(s) {
  const gastos = gastosDoServico(s.id);
  const totalGastos = gastos.reduce((t, g) => t + (Number(g.valor) || 0), 0);
  return `<div class="custos-servico">
    <div class="fotos-cab"><b>Gastos deste serviço</b><button type="button" class="btn sec peq" id="add-gasto">+ Gasto</button></div>
    ${gastos.length ? `<ul class="lista-simples">${gastos.map((g) => `<li><span>${esc(g.descricao || g.categoria)}</span><b>${moeda(g.valor)}</b></li>`).join('')}</ul>` : '<p class="ajuda">Nenhum gasto ligado (material, combustível, descarte...).</p>'}
    ${valorServico(s) ? `<div class="lucro-linha">Lucro do serviço: <b class="${valorServico(s) - totalGastos < 0 ? 'texto-vermelho' : 'texto-verde'}">${moeda(valorServico(s) - totalGastos)}</b></div>` : ''}
  </div>`;
}
function ligarCustos(el, s) {
  const b = $('#add-gasto', el);
  if (b) b.addEventListener('click', () => formLancamento(null, { tipo: 'gasto', servicoId: s.id, data: hojeISO() }, () => {
    if (protegerSaida && protegerSaida.sujo()) { avisar('Gasto salvo. Salve o serviço para ver o lucro atualizado.'); return; }
    render();
  }));
}

/* ---------- Assinatura na tela ---------- */
function padAssinatura(caixa, atual, aoMudar) {
  caixa.innerHTML = `<div class="assinatura-caixa"><canvas></canvas><div class="assinatura-dica">Assine aqui com o dedo</div></div>
    <button type="button" class="btn sec peq" data-limpar>Limpar assinatura</button>`;
  const canvas = $('canvas', caixa), dica = $('.assinatura-dica', caixa);
  const ctx = canvas.getContext('2d');
  let desenhando = false, ultimo = null, tem = false;
  const ajustar = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    canvas.width = r.width * 2;
    canvas.height = r.height * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a237e';
    if (atual) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = atual;
      tem = true;
      dica.hidden = true;
    }
  };
  requestAnimationFrame(ajustar);
  const ponto = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => { desenhando = true; ultimo = ponto(e); canvas.setPointerCapture(e.pointerId); dica.hidden = true; });
  canvas.addEventListener('pointermove', (e) => {
    if (!desenhando) return;
    const p = ponto(e);
    ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo = p;
    tem = true;
  });
  const fim = () => {
    if (!desenhando) return;
    desenhando = false;
    if (tem) aoMudar(canvas.toDataURL('image/png'));
  };
  canvas.addEventListener('pointerup', fim);
  canvas.addEventListener('pointercancel', fim);
  $('[data-limpar]', caixa).addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    tem = false;
    atual = '';
    dica.hidden = false;
    aoMudar('');
  });
}

/* ---------- Enviar pelo WhatsApp ---------- */
function enviarLaudoWhatsApp(s, botao) {
  const cli = DB.obter('clientes', s.clienteId) || {};
  const g = fimGarantia(s);
  const msg = preencherMsg(DB.config().msgLaudo || MSG_LAUDO, {
    nome: cli.contato || cli.nome || '', numero: s.numero, data: dataBR(s.data), servico: resumoServico(s).toLowerCase(),
    garantia: g ? `Garantia até ${dataBR(g)}.` : '', empresa: nomeEmpresa(),
  }).replace(/\s+\./g, '.').trim();
  enviarPdfWhatsApp({ html: documentoLaudo(s), arquivo: `Laudo ${s.numero} - ${cli.nome || 'cliente'}`, mensagem: msg, telefone: cli.telefone, botao });
}
function enviarReciboWhatsApp(s, botao) {
  const cli = DB.obter('clientes', s.clienteId) || {};
  const msg = `Olá, ${cli.contato || cli.nome || ''}! Segue o recibo do serviço nº ${s.numero} (${moeda(valorServico(s))}). Obrigado pela preferência! ${nomeEmpresa()}.`;
  enviarPdfWhatsApp({ html: documentoRecibo(s), arquivo: `Recibo ${s.numero} - ${cli.nome || 'cliente'}`, mensagem: msg, telefone: cli.telefone, botao });
}
const MSG_LAUDO = 'Olá, {nome}! Segue o laudo nº {numero} do serviço realizado em {data} ({servico}). {garantia} Qualquer dúvida estamos à disposição. {empresa}.';
