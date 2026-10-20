// Início (painel), retornos de manutenção preventiva, configurações, menu, rotas e login.

/* ---------- Início ---------- */
function inicio(el) {
  const am = mesAtual(), hoje = hojeISO();
  const p = DB.perfil() || {};
  const totE = somar(entradasDoMes(am)), totG = somar(gastosDoMes(am));
  const execucao = DB.listar('servicos').filter((s) => s.status !== 'concluido').sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  const receber = aReceber();
  const totReceber = receber.reduce((t, s) => t + valorServico(s), 0);
  const contas = contasAPagar().filter((l) => (l.vencimento || l.data) <= somarDias(hoje, 3));
  const fixos = fixosPendentes(am);
  const retornos = listaRetornos().filter((r) => r.quando <= somarDias(hoje, 15) && !r.avisadoRecente);
  const orcPend = DB.listar('orcamentos').filter((o) => (o.status || 'pendente') === 'pendente');
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  el.innerHTML = `
    <div class="cabecalho"><h2>${saudacao}${p.nome ? ', ' + esc(p.nome.split(' ')[0]) : ''}!</h2></div>
    <div class="atalhos">
      <button class="atalho principal" data-ir="novo-servico">${icone('servicos')}<span>Novo serviço</span></button>
      <button class="atalho" data-ir="novo-gasto">${icone('gastos')}<span>Lançar gasto</span></button>
      <button class="atalho" data-ir="nova-entrada">${icone('financeiro')}<span>Lançar entrada</span></button>
      <button class="atalho" data-ir="novo-orc">${icone('orcamentos')}<span>Orçamento</span></button>
    </div>
    <div class="grade-kpi">
      <div class="kpi"><div class="rotulo">Entrou em ${MESES[Number(am.slice(5)) - 1].toLowerCase()}</div><div class="valor texto-verde">${moeda(totE)}</div></div>
      <div class="kpi"><div class="rotulo">Gastos do mês</div><div class="valor texto-vermelho">${moeda(totG)}</div></div>
      <div class="kpi destaque"><div class="rotulo">Sobrou no mês</div><div class="valor ${totE - totG < 0 ? 'texto-vermelho' : ''}">${moeda(totE - totG)}</div></div>
      <div class="kpi clicavel" data-ir="receber"><div class="rotulo">A receber</div><div class="valor">${moeda(totReceber)}</div>
        <small>${receber.length} serviço(s)</small></div>
    </div>
    ${contas.length || fixos.length ? `<div class="cartao alerta-cartao" data-ir="pagar"><h3>Contas a pagar</h3>
      ${contas.map((l) => `<div class="linha-alerta"><span>${esc(l.descricao || l.categoria)} — ${dataBR(l.vencimento || l.data)}</span><b>${moeda(l.valor)}</b></div>`).join('')}
      ${fixos.length ? `<div class="linha-alerta"><span>${fixos.length} gasto(s) fixo(s) do mês para lançar</span></div>` : ''}</div>` : ''}
    <div class="cartao"><div class="fotos-cab"><h3 style="margin:0">Em execução</h3><button class="btn sec peq" data-ir="servicos">Ver todos</button></div>
      ${execucao.length ? listaServicosHTML(execucao.slice(0, 8)) : '<p class="ajuda" style="margin:8px 0 0">Nenhum serviço em execução.</p>'}</div>
    ${retornos.length ? `<div class="cartao"><div class="fotos-cab"><h3 style="margin:0">Manutenção preventiva para avisar</h3>
      <button class="btn sec peq" data-ir="retornos">Ver todos</button></div>
      ${retornos.slice(0, 5).map((r) => `<div class="linha-alerta"><span><b>${esc(r.cliente.nome)}</b> — ${r.quando < hoje ? 'venceu' : 'vence'} em ${dataBR(r.quando)}</span>
        <button class="btn sec peq whats" data-avisar="${r.cliente.id}">WhatsApp</button></div>`).join('')}</div>` : ''}
    ${orcPend.length ? `<div class="cartao clicavel" data-ir="orcamentos"><h3 style="margin:0">${orcPend.length} orçamento(s) aguardando resposta</h3></div>` : ''}`;
  el.addEventListener('click', (e) => {
    const av = e.target.closest('[data-avisar]');
    if (av) { avisarRetorno(av.dataset.avisar); return; }
    if (e.target.closest('[data-servico]')) return;
    const b = e.target.closest('[data-ir]');
    if (!b) return;
    const ir = b.dataset.ir;
    if (ir === 'novo-servico') novoServico();
    else if (ir === 'novo-gasto') formLancamento(null, { tipo: 'gasto' });
    else if (ir === 'nova-entrada') formLancamento(null, { tipo: 'entrada', categoria: 'Serviço avulso' });
    else if (ir === 'novo-orc') novoOrcamento();
    else if (ir === 'receber' || ir === 'pagar') { estado('financeiro', { mes: mesAtual() }).aba = ir; irPara('financeiro'); }
    else irPara(ir);
  });
  ligarListaServicos(el);
}

/* ---------- Retornos (manutenção preventiva) ---------- */
// Para cada cliente, o último serviço define quando avisar: data + "manutenção preventiva" (meses).
function listaRetornos() {
  const ultimo = new Map();
  DB.listar('servicos').forEach((s) => {
    const u = ultimo.get(s.clienteId);
    if (!u || (s.data || '') > (u.data || '')) ultimo.set(s.clienteId, s);
  });
  const hoje = hojeISO();
  return [...ultimo.values()].filter((s) => Number(s.retornoMeses) > 0 && DB.obter('clientes', s.clienteId))
    .map((s) => {
      const cliente = DB.obter('clientes', s.clienteId);
      const quando = somarMeses(s.dataConclusao || s.data, Number(s.retornoMeses));
      const avisadoRecente = Boolean(cliente.avisadoRetorno && cliente.avisadoRetorno >= somarDias(quando, -30) && cliente.avisadoRetorno <= hoje);
      return { servico: s, cliente, quando, avisadoRecente };
    })
    .sort((a, b) => a.quando.localeCompare(b.quando));
}
const MSG_RETORNO = 'Olá, {nome}! Aqui é da {empresa}. Já está chegando a hora da manutenção preventiva ({servico}), feita pela última vez em {data}. Vamos agendar?';
function avisarRetorno(clienteId) {
  const r = listaRetornos().find((x) => x.cliente.id === clienteId);
  if (!r) return;
  abrirWhats(r.cliente.telefone, preencherMsg(DB.config().msgRetorno || MSG_RETORNO, {
    nome: r.cliente.contato || r.cliente.nome, empresa: nomeEmpresa(), servico: resumoServico(r.servico).toLowerCase(), data: dataBR(r.servico.data),
  }));
  DB.salvarItem('clientes', { id: clienteId, avisadoRetorno: hojeISO() });
  setTimeout(render, 500);
}
function retornos(el) {
  const hoje = hojeISO();
  const lista = listaRetornos();
  const grupos = [
    ['Vencidos', lista.filter((r) => r.quando < hoje)],
    ['Próximos 30 dias', lista.filter((r) => r.quando >= hoje && r.quando <= somarDias(hoje, 30))],
    ['Mais para frente', lista.filter((r) => r.quando > somarDias(hoje, 30))],
  ];
  el.innerHTML = `
    <div class="cabecalho"><h2>Retornos</h2></div>
    <p class="ajuda">Clientes com manutenção preventiva marcada no último serviço (caixa de gordura, fossa, rede do condomínio...).
      Ao enviar o WhatsApp, o cliente fica marcado como avisado.</p>
    ${lista.length ? grupos.filter(([, l]) => l.length).map(([titulo, l]) => `<h3>${titulo}</h3><div class="lista-cartoes">${l.map((r) => `
      <div class="item-lista"><div class="item-info"><b>${esc(r.cliente.nome)}</b>
        <small>${esc(resumoServico(r.servico))} · último em ${dataBR(r.servico.data)}</small>
        <small>Próxima: <b>${dataBR(r.quando)}</b>${r.cliente.avisadoRetorno ? ` · avisado em ${dataBR(r.cliente.avisadoRetorno)}` : ''}</small></div>
        <div class="acoes"><button class="btn sec peq whats" data-avisar="${r.cliente.id}">WhatsApp</button>
          <button class="btn sec peq" data-novo="${r.cliente.id}">Novo serviço</button></div></div>`).join('')}</div>`).join('')
      : '<div class="cartao vazio">Nenhum retorno marcado. No serviço, escolha "Manutenção preventiva" para o cliente aparecer aqui.</div>'}`;
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-avisar]');
    const n = e.target.closest('[data-novo]');
    if (a) avisarRetorno(a.dataset.avisar);
    if (n) novoServico({ clienteId: n.dataset.novo });
  });
}

/* ---------- Configurações ---------- */
function configuracoes(el) {
  const c = DB.config();
  const tabela = (c.tabelaPrecos || []).map((t) => ({ ...t }));
  const fixos = (c.gastosFixos || []).map((f) => ({ ...f }));
  el.innerHTML = `
    <div class="cabecalho"><h2>Configurações</h2></div>
    <div class="cartao"><h3>Dados da empresa (aparecem no laudo, recibo e orçamento)</h3>
      <form class="form" id="form-empresa">
        ${campo('Nome da empresa', 'empresa', c.empresa || 'Berbert Hidrotech', 'text', 'full')}
        ${campo('Responsável (assina os documentos)', 'responsavel', c.responsavel)}
        ${campo('CNPJ', 'cnpj', c.cnpj)}
        ${campo('Telefone / WhatsApp', 'telefone', c.telefone, 'tel')}
        ${campo('E-mail', 'email', c.email, 'email')}
        ${campo('Endereço', 'endereco', c.endereco, 'text', 'full')}
        ${campo('Cidade (sai no recibo)', 'cidade', c.cidade)}
        ${campo('Chave Pix (vai na mensagem de cobrança)', 'pix', c.pix)}
        <div class="form-acoes"><button class="btn">Salvar</button></div>
      </form></div>
    <div class="cartao"><h3>Padrões</h3>
      <form class="form" id="form-padroes">
        <label>Garantia padrão do serviço<select name="garantiaPadrao">${opcoesSimples(GARANTIAS, c.garantiaPadrao ?? 30)}</select></label>
        ${campo('Cidade padrão do cliente', 'cidadePadrao', c.cidadePadrao)}
        ${campo('Limite de faturamento do MEI no ano (R$)', 'limiteMei', c.limiteMei ?? 81000, 'dinheiro')}
        ${campo('Condições de pagamento do orçamento', 'condicoesPagamento', c.condicoesPagamento || 'Pix, dinheiro ou cartão.')}
        ${campo('Texto da garantia no laudo', 'textoGarantia', c.textoGarantia || TEXTO_GARANTIA, 'textarea', 'full')}
        <div class="form-acoes"><button class="btn">Salvar</button></div>
      </form></div>
    <div class="cartao"><h3>Tabela de preços</h3>
      <p class="ajuda">Serviços que você mais faz, com o valor de costume. No serviço e no orçamento é só escolher na lista.</p>
      <div id="tabela"></div>
      <div class="acoes"><button class="btn sec peq" id="add-preco">+ Serviço</button><button class="btn peq" id="salvar-tabela">Salvar tabela</button></div></div>
    <div class="cartao"><h3>Gastos fixos do mês</h3>
      <p class="ajuda">Contas que se repetem todo mês. Em Financeiro → Contas a pagar aparece o botão para lançar as do mês.</p>
      <div id="fixos"></div>
      <div class="acoes"><button class="btn sec peq" id="add-fixo">+ Gasto fixo</button><button class="btn peq" id="salvar-fixos">Salvar gastos fixos</button></div></div>
    <div class="cartao"><h3>Mensagens do WhatsApp</h3>
      <form class="form" id="form-msgs">
        <label class="full">Envio do laudo ({nome}, {numero}, {data}, {servico}, {garantia}, {empresa})
          <textarea name="msgLaudo" rows="3">${esc(c.msgLaudo || MSG_LAUDO)}</textarea></label>
        <label class="full">Aviso de manutenção preventiva ({nome}, {servico}, {data}, {empresa})
          <textarea name="msgRetorno" rows="3">${esc(c.msgRetorno || MSG_RETORNO)}</textarea></label>
        <label class="full">Lembrete de pagamento ({nome}, {numero}, {data}, {valor}, {pix}, {empresa})
          <textarea name="msgCobranca" rows="3">${esc(c.msgCobranca || MSG_COBRANCA)}</textarea></label>
        <div class="form-acoes"><button class="btn">Salvar</button></div>
      </form></div>
    <div class="cartao"><h3>Backup dos dados</h3>
      <p class="ajuda">Os dados ficam no banco na nuvem. Mesmo assim, é bom baixar uma cópia de vez em quando.</p>
      <div class="acoes">
        <button class="btn" id="exportar">Baixar backup</button>
        <label class="btn sec">Restaurar backup<input type="file" id="importar" accept="application/json,.json" hidden></label>
      </div></div>`;
  const salvarForm = (id, msg, transformar = (d) => d) => {
    $(id, el).addEventListener('submit', (e) => {
      e.preventDefault();
      const d = transformar(lerForm(e.target));
      enviando($('button', e.target), async () => { await DB.salvarConfig(d); avisar(msg); });
    });
  };
  salvarForm('#form-empresa', 'Dados da empresa salvos.');
  salvarForm('#form-padroes', 'Padrões salvos.', (d) => ({ ...d, garantiaPadrao: Number(d.garantiaPadrao) || 0, limiteMei: num(d.limiteMei) }));
  salvarForm('#form-msgs', 'Mensagens salvas.');

  // Tabela de preços
  const lerTabela = () => $$('#tabela .item-valor-linha', el).map((l) => ({ descricao: $('[data-c=descricao]', l).value.trim(), valor: num($('[data-c=valor]', l).value) }));
  const desenharTabela = (lista) => {
    $('#tabela', el).innerHTML = lista.length ? lista.map((t) => `<div class="item-valor-linha duas">
      <input data-c="descricao" placeholder="Ex.: Desentupimento de pia" value="${esc(t.descricao || '')}">
      <input data-c="valor" inputmode="decimal" placeholder="Valor" value="${esc(valorCampo(t.valor))}">
      <button type="button" class="btn sec peq" data-tirar>&times;</button></div>`).join('') : '<p class="ajuda">Nenhum serviço na tabela.</p>';
  };
  desenharTabela(tabela.length ? tabela : SUGESTAO_PRECOS);
  $('#add-preco', el).addEventListener('click', () => desenharTabela([...lerTabela(), {}]));
  $('#tabela', el).addEventListener('click', (e) => {
    if (!e.target.matches('[data-tirar]')) return;
    const lista = lerTabela();
    lista.splice($$('#tabela [data-tirar]', el).indexOf(e.target), 1);
    desenharTabela(lista);
  });
  $('#salvar-tabela', el).addEventListener('click', (e) => enviando(e.target, async () => {
    await DB.salvarConfig({ tabelaPrecos: lerTabela().filter((t) => t.descricao) });
    avisar('Tabela de preços salva.');
  }));

  // Gastos fixos
  const lerFixos = () => $$('#fixos .fixo-linha', el).map((l) => ({
    id: l.dataset.id || DB.novoId(), descricao: $('[data-c=descricao]', l).value.trim(), categoria: $('[data-c=categoria]', l).value,
    valor: num($('[data-c=valor]', l).value), dia: Math.min(31, Math.max(1, Number($('[data-c=dia]', l).value) || 10)),
  }));
  const desenharFixos = (lista) => {
    $('#fixos', el).innerHTML = lista.length ? lista.map((f) => `<div class="fixo-linha" data-id="${esc(f.id || '')}">
      <input data-c="descricao" placeholder="Ex.: DAS MEI" value="${esc(f.descricao || '')}">
      <select data-c="categoria">${opcoesSimples(CATEGORIAS_GASTO, f.categoria || 'Outros')}</select>
      <input data-c="valor" inputmode="decimal" placeholder="Valor" value="${esc(valorCampo(f.valor))}">
      <label class="dia-venc">dia<input data-c="dia" type="number" min="1" max="31" value="${esc(f.dia || 10)}"></label>
      <button type="button" class="btn sec peq" data-tirar>&times;</button></div>`).join('') : '<p class="ajuda">Nenhum gasto fixo.</p>';
  };
  desenharFixos(fixos);
  $('#add-fixo', el).addEventListener('click', () => desenharFixos([...lerFixos(), { categoria: 'Outros', dia: 10 }]));
  $('#fixos', el).addEventListener('click', (e) => {
    if (!e.target.matches('[data-tirar]')) return;
    const lista = lerFixos();
    lista.splice($$('#fixos [data-tirar]', el).indexOf(e.target), 1);
    desenharFixos(lista);
  });
  $('#salvar-fixos', el).addEventListener('click', (e) => enviando(e.target, async () => {
    const lista = lerFixos().filter((f) => f.descricao);
    await DB.salvarConfig({ gastosFixos: lista });
    desenharFixos(lista);
    avisar('Gastos fixos salvos.');
  }));

  // Backup
  $('#exportar', el).addEventListener('click', () => baixarArquivo(DB.exportar(), `backup-hidrotech-${hojeISO()}.json`, 'application/json'));
  $('#importar', el).addEventListener('change', async (e) => {
    const arq = e.target.files[0];
    e.target.value = '';
    if (!arq) return;
    if (!confirmar('Os registros do backup serão gravados no banco (os que tiverem o mesmo código serão substituídos). Continuar?')) return;
    try {
      avisar('Restaurando...');
      await DB.importar(await arq.text());
      avisar('Backup restaurado!');
      render();
    } catch (err) {
      avisar('Não foi possível restaurar: ' + err.message, 'erro');
    }
  });
}
const SUGESTAO_PRECOS = [
  { descricao: 'Desentupimento de pia' }, { descricao: 'Desentupimento de vaso sanitário' }, { descricao: 'Desentupimento de ralo' },
  { descricao: 'Desentupimento de rede de esgoto' }, { descricao: 'Limpeza de caixa de gordura' }, { descricao: 'Hidrojateamento (por hora)' },
  { descricao: 'Inspeção com câmera' }, { descricao: 'Visita técnica' },
];

/* ---------- Menu e rotas ---------- */
const ROTAS = [
  { rota: 'inicio', titulo: 'Início', fn: inicio },
  { rota: 'servicos', titulo: 'Serviços', fn: servicos },
  { rota: 'servico', fn: paginaServico, menu: 'servicos', foraDoMenu: true },
  { rota: 'clientes', titulo: 'Clientes', fn: clientes },
  { rota: 'cliente', fn: paginaCliente, menu: 'clientes', foraDoMenu: true },
  { rota: 'financeiro', titulo: 'Financeiro', fn: financeiro },
  { rota: 'orcamentos', titulo: 'Orçamentos', fn: orcamentos },
  { rota: 'orcamento', fn: paginaOrcamento, menu: 'orcamentos', foraDoMenu: true },
  { rota: 'retornos', titulo: 'Retornos', fn: retornos, icone: 'manutencao' },
  { rota: 'config', titulo: 'Configurações', fn: configuracoes },
];
function montarMenu() {
  $('#menu-links').innerHTML = ROTAS.filter((r) => !r.foraDoMenu)
    .map((r) => `<a href="#" data-rota="${r.rota}">${icone(r.icone || r.rota)}<span>${r.titulo}</span></a>`).join('');
  $('#menu-btn').innerHTML = icone('menu');
  $('#barra-baixo').innerHTML = `
    <a href="#" data-rota="inicio">${icone('inicio')}<span>Início</span></a>
    <a href="#" data-rota="servicos">${icone('servicos')}<span>Serviços</span></a>
    <button id="botao-mais" aria-label="Lançar">${icone('mais')}</button>
    <a href="#" data-rota="financeiro">${icone('financeiro')}<span>Financeiro</span></a>
    <a href="#" data-rota="clientes">${icone('clientes')}<span>Clientes</span></a>`;
  montarPerfil();
}
function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
function montarPerfil() {
  const p = DB.perfil();
  const nome = p.nome || p.email;
  $('#perfil-btn').innerHTML = `<span class="avatar">${esc(iniciais(nome))}</span>
    <span class="perfil-txt"><b>${esc(nome)}</b><small>${esc(p.email || '')}</small></span>${icone('seta')}`;
  $('#perfil-menu').innerHTML = `
    <button data-perfil="nome">${icone('conta')}Meu nome</button>
    <button data-perfil="senha">${icone('senha')}Alterar senha</button>
    <button data-perfil="sair" class="sair">${icone('sair')}Sair</button>`;
}
function abrirMenuPerfil(abrir) {
  $('#perfil-menu').hidden = !abrir;
  $('#perfil-btn').setAttribute('aria-expanded', String(abrir));
  $('#perfil').classList.toggle('aberto', abrir);
}
$('#perfil-btn').addEventListener('click', (e) => { e.stopPropagation(); abrirMenuPerfil($('#perfil-menu').hidden); });
$('#perfil-menu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-perfil]');
  if (!b) return;
  abrirMenuPerfil(false);
  $('#menu').classList.remove('aberto');
  if (b.dataset.perfil === 'nome') formMeuNome();
  if (b.dataset.perfil === 'senha') formMinhaSenha();
  if (b.dataset.perfil === 'sair') sair();
});
document.addEventListener('click', (e) => {
  if (!$('#perfil-menu').hidden && !e.target.closest('#perfil')) abrirMenuPerfil(false);
  if ($('#menu').classList.contains('aberto') && !e.target.closest('#menu') && !e.target.closest('#menu-btn')) $('#menu').classList.remove('aberto');
});
function formMeuNome() {
  abrirModal('Meu nome', `<form class="form" id="form-nome">${campo('Nome (aparece na saudação)', 'nome', DB.perfil().nome, 'text', 'full required')}
    <div class="form-acoes"><button class="btn">Salvar</button></div></form>`, (raiz) => {
    $('#form-nome', raiz).addEventListener('submit', (e) => {
      e.preventDefault();
      enviando($('button', e.target), async () => {
        await DB.alterarMeuNome(lerForm(e.target).nome);
        fecharModal();
        montarPerfil();
        render();
      });
    });
  });
}
function formMinhaSenha() {
  abrirModal('Alterar senha', `<form class="form" id="form-senha">
      ${campo('Nova senha', 'senha', '', 'password', 'required minlength="6" autocomplete="new-password"')}
      ${campo('Repita a nova senha', 'senha2', '', 'password', 'required minlength="6" autocomplete="new-password"')}
      <div class="form-acoes"><button class="btn">Alterar</button></div></form>`, (raiz) => {
    $('#form-senha', raiz).addEventListener('submit', (e) => {
      e.preventDefault();
      const d = lerForm(e.target);
      if (d.senha !== d.senha2) { avisar('As senhas não são iguais.', 'erro'); return; }
      enviando($('button', e.target), async () => { await DB.alterarMinhaSenha(d.senha); fecharModal(); avisar('Senha alterada.'); });
    });
  });
}
function menuMais() {
  abrirModal('Lançar', `<div class="menu-mais">
    <button data-mais="servico">${icone('servicos')}<span>Novo serviço</span></button>
    <button data-mais="gasto">${icone('gastos')}<span>Gasto</span></button>
    <button data-mais="entrada">${icone('financeiro')}<span>Entrada</span></button>
    <button data-mais="orcamento">${icone('orcamentos')}<span>Orçamento</span></button>
    <button data-mais="cliente">${icone('clientes')}<span>Cliente</span></button></div>`, (raiz) => {
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mais]');
      if (!b) return;
      fecharModal();
      const o = b.dataset.mais;
      if (o === 'servico') novoServico();
      if (o === 'gasto') formLancamento(null, { tipo: 'gasto' });
      if (o === 'entrada') formLancamento(null, { tipo: 'entrada', categoria: 'Serviço avulso' });
      if (o === 'orcamento') novoOrcamento();
      if (o === 'cliente') formCliente(null, (c) => irPara('cliente/' + c.id));
    });
  });
}

// A tela atual fica guardada (e no histórico do navegador) sem aparecer no endereço.
let rotaAtiva = (() => { try { return sessionStorage.getItem('hidrotech-rota') || 'inicio'; } catch { return 'inicio'; } })();
function podeSair() {
  if (!protegerSaida || !protegerSaida.sujo()) return true;
  if (!confirmar('Sair sem salvar? As alterações desta tela serão perdidas.')) return false;
  protegerSaida.descartar();
  protegerSaida = null;
  return true;
}
function irPara(rota, substituir = false) {
  if (!substituir && !podeSair()) return;
  protegerSaida = null;
  rotaAtiva = rota;
  try { sessionStorage.setItem('hidrotech-rota', rota); } catch { /* sem armazenamento */ }
  history[substituir ? 'replaceState' : 'pushState']({ rota }, '', location.pathname + location.search);
  render();
}
function render() {
  const [base, ...resto] = rotaAtiva.split('/');
  const r = ROTAS.find((x) => x.rota === base) || ROTAS[0];
  $$('.menu a, .barra-baixo a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === (r.menu || r.rota)));
  $('#menu').classList.remove('aberto');
  // Troca o <main> inteiro: assim os eventos da tela anterior não se acumulam.
  const antigo = $('#view');
  const novo = document.createElement('main');
  novo.id = 'view';
  antigo.replaceWith(novo);
  window.scrollTo(0, 0);
  try {
    r.fn(novo, resto.join('/'));
  } catch (e) {
    console.error(e);
    novo.innerHTML = `<div class="cartao"><p>Algo deu errado nesta tela.</p><p class="ajuda">${esc(e.message)}</p>
      <button class="btn sec" onclick="irPara('inicio')">Voltar ao início</button></div>`;
  }
}
window.addEventListener('popstate', (e) => {
  if ($('#app').hidden || !e.state || !e.state.rota) return;
  if (!$('#modal').hidden) { fecharModal(); history.pushState({ rota: rotaAtiva }, '', location.pathname + location.search); return; }
  if (!podeSair()) { history.pushState({ rota: rotaAtiva }, '', location.pathname + location.search); return; }
  rotaAtiva = e.state.rota;
  try { sessionStorage.setItem('hidrotech-rota', rotaAtiva); } catch { /* sem armazenamento */ }
  render();
});
window.addEventListener('beforeunload', (e) => {
  if ((protegerSaida && protegerSaida.sujo()) || DB.pendentes()) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-rota]');
  if (!a) return;
  e.preventDefault();
  if (a.dataset.rota !== rotaAtiva) irPara(a.dataset.rota);
  else $('#menu').classList.remove('aberto');
});
$('#menu-btn').addEventListener('click', () => $('#menu').classList.toggle('aberto'));
$('#barra-baixo').addEventListener('click', (e) => { if (e.target.closest('#botao-mais')) menuMais(); });

// Atualiza os dados ao voltar para o app (ex.: alterou pelo computador e abriu no celular).
async function atualizarDados() {
  if (!DB.perfil() || $('#app').hidden || DB.carregadoHa() < 30000) return;
  try {
    await DB.carregar();
    if ($('#modal').hidden && !(protegerSaida && protegerSaida.sujo()) && !/^(servico|orcamento)\//.test(rotaAtiva)) render();
  } catch { /* sem conexão: tenta depois */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { atualizarDados(); verificarVersao(); } });

// Indicador de alterações esperando internet.
DB.definirAoMudarFila((n) => {
  const s = $('#sinc');
  s.hidden = !n && !DB.offline();
  s.innerHTML = `${icone('nuvem')}<span>${n ? `${n} alteração(ões) esperando internet` : 'Sem internet'}</span>`;
  s.className = 'sinc' + (n ? ' pendente' : '');
});
$('#sinc').addEventListener('click', () => DB.enviarFila().then(() => avisar(DB.pendentes() ? 'Ainda sem internet. Vai enviar sozinho quando voltar.' : 'Tudo enviado!')));

/* ---------- Versão nova ---------- */
const VERSAO_APP = '2026-10-20.2';
async function verificarVersao() {
  try {
    const r = await fetch('versao.json', { cache: 'no-store' });
    const { versao } = await r.json();
    if (versao && versao !== VERSAO_APP) $('#nova-versao').hidden = false;
  } catch { /* sem conexão */ }
}
$('#nova-versao-btn').addEventListener('click', () => { if (podeSair()) location.reload(); });
setInterval(verificarVersao, 10 * 60 * 1000);

/* ---------- Login e inicialização ---------- */
function mostrarTela(id) {
  ['carregando', 'tela-login', 'tela-aviso', 'app'].forEach((t) => ($('#' + t).hidden = t !== id));
}
function mostrarAviso(html) {
  $('#aviso-texto').innerHTML = html;
  mostrarTela('tela-aviso');
}
async function entrarNoApp(perfil) {
  if (!perfil) { mostrarTela('tela-login'); return; }
  if (!perfil.ativo) {
    mostrarAviso(`<p>Este login ainda não foi liberado.</p>
      <p class="ajuda">Só o primeiro login criado entra direto. Para liberar outra pessoa, veja o README (passo "Liberar outro login").</p>
      <button class="btn" id="aviso-sair">Voltar</button>`);
    $('#aviso-sair').addEventListener('click', async () => { await DB.sair(); mostrarTela('tela-login'); });
    return;
  }
  mostrarTela('carregando');
  await DB.carregar();
  montarMenu();
  mostrarTela('app');
  history.replaceState({ rota: rotaAtiva }, '', location.pathname + location.search);
  render();
  if (DB.offline()) avisar('Sem internet: mostrando os dados guardados neste aparelho.', 'ok', 5000);
}
$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = lerForm(e.target);
  const erro = $('#login-erro');
  const botao = $('button', e.target);
  erro.hidden = true;
  botao.disabled = true;
  botao.textContent = 'Entrando...';
  try {
    const perfil = await DB.entrar(d.email, d.senha);
    e.target.reset();
    await entrarNoApp(perfil);
  } catch (err) {
    erro.textContent = DB.traduzirErro(err);
    erro.hidden = false;
    mostrarTela('tela-login');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
});
$('#esqueci').addEventListener('click', async () => {
  const email = $('#form-login').email.value.trim();
  if (!email) { avisar('Digite seu e-mail no campo acima e toque de novo em "Esqueci a senha".', 'erro'); return; }
  try {
    await DB.enviarRedefinicaoSenha(email);
    avisar('Enviamos um e-mail com o link para trocar a senha.', 'ok', 6000);
  } catch (err) {
    avisar(err.message, 'erro');
  }
});
async function sair() {
  if (!podeSair()) return;
  if (!(await DB.sair())) return;
  rotaAtiva = 'inicio';
  try { sessionStorage.removeItem('hidrotech-rota'); } catch { /* sem armazenamento */ }
  history.replaceState(null, '', location.pathname + location.search);
  mostrarTela('tela-login');
}

DB.definirAoErro((msg) => avisar(msg, 'erro'));
(async () => {
  if (!DB.configurado()) {
    mostrarAviso(`<h3>Banco de dados não configurado</h3>
      <p class="ajuda">Preencha o endereço e a chave do Supabase no arquivo <code>js/config.js</code>.
      O passo a passo está no arquivo README do projeto.</p>`);
    return;
  }
  try {
    await entrarNoApp(await DB.iniciar());
  } catch (e) {
    mostrarAviso(`<p>Não foi possível conectar ao banco de dados.</p><p class="ajuda">${esc(DB.traduzirErro(e))}</p>
      <button class="btn" id="tentar">Tentar novamente</button>`);
    $('#tentar').addEventListener('click', () => location.reload());
  }
  verificarVersao();
})();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
