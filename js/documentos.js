// Documentos impressos / em PDF: laudo técnico (com fotos), recibo e orçamento.

function blocoClienteDoc(cli) {
  if (!cli) return '';
  return `<div class="info">
    <div><b>Cliente:</b> ${esc(cli.nome)}</div><div>${cli.documento ? `<b>CPF/CNPJ:</b> ${esc(cli.documento)}` : `<b>Telefone:</b> ${esc(cli.telefone || '')}`}</div>
    <div style="grid-column:1/-1"><b>Endereço:</b> ${esc(enderecoCliente(cli))}</div>
  </div>`;
}
const listaDoc = (itens) => (itens || []).map(esc).join(', ');

/* ---------- Laudo técnico ---------- */
async function documentoLaudo(s) {
  const cli = DB.obter('clientes', s.clienteId) || {};
  const cfg = DB.config();
  const fotos = s.fotos || [];
  const urls = fotos.length ? await urlsFotos(fotos.map((f) => f.caminho)) : {};
  const etapas = ETAPAS_FOTO.map(([etapa, rotulo]) => [rotulo, fotos.filter((f) => f.etapa === etapa && urls[f.caminho])]).filter(([, l]) => l.length);
  const g = fimGarantia(s);
  const procedimento = [...(s.realizados || [])];
  const linha = (rotulo, valor) => (valor ? `<p><b>${rotulo}:</b> ${valor}</p>` : '');
  return `<div class="doc laudo">${cabecalhoDoc()}
    <h2>Laudo Técnico de Serviço nº ${s.numero}</h2>
    ${blocoClienteDoc(cli)}
    <div class="info" style="margin-top:4px">
      <div><b>Data do serviço:</b> ${dataBR(s.data)}</div>
      <div><b>Situação:</b> ${s.status === 'concluido' ? `Concluído${s.dataConclusao && s.dataConclusao !== s.data ? ' em ' + dataBR(s.dataConclusao) : ''}` : 'Em execução'}</div>
    </div>
    <h3>Serviço executado</h3>
    ${linha('Serviço', listaDoc(s.tipos))}
    ${linha('Local', listaDoc(s.locais))}
    ${linha('Problema relatado', esc(s.problema))}
    <h3>Diagnóstico</h3>
    ${linha('Causa encontrada', listaDoc(s.causas)) || '<p>—</p>'}
    <h3>Procedimento</h3>
    ${linha('Realizado', listaDoc(procedimento))}
    ${linha('Equipamentos utilizados', listaDoc(s.equipamentos))}
    ${linha('Tubulação desobstruída', s.metragem ? esc(s.metragem) + ' metros' : '')}
    ${s.descricao ? `<p style="white-space:pre-line">${esc(s.descricao)}</p>` : ''}
    ${etapas.length ? `<h3>Registro fotográfico</h3><div class="fotos-laudo col-${etapas.length}">${etapas.map(([rotulo, lista]) => `<div>
      <div class="fotos-laudo-tit">${rotulo.toUpperCase()}</div><div class="fotos-laudo-grade">${lista.map((f) => `<figure>
      <img src="${esc(urls[f.caminho])}" alt="">${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ''}</figure>`).join('')}</div></div>`).join('')}</div>` : ''}
    ${(s.recomendacoes || []).length ? `<h3>Recomendações</h3><ul>${s.recomendacoes.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
    <h3>Garantia</h3>
    <p>${g ? `Garantia de ${s.garantiaDias} dias, válida até <b>${dataBR(g)}</b>, para o mesmo trecho atendido. ${esc(cfg.textoGarantia || TEXTO_GARANTIA)}` : 'Serviço sem garantia.'}</p>
    <div class="assinatura">
      <div>${esc(cfg.responsavel || nomeEmpresa())}<br>${esc(nomeEmpresa())}</div>
      <div>${s.assinatura ? `<img src="${s.assinatura}" class="assinatura-img" alt="">` : ''}${esc(s.assinouNome || cli.nome || 'Cliente')}</div>
    </div>
  </div>`;
}
const TEXTO_GARANTIA = 'A garantia não cobre novo entupimento causado por mau uso (descarte de gordura, papel, lenço umedecido, absorvente, fralda ou objetos), nem tubulação quebrada, com caimento errado ou danificada por raízes.';

/* ---------- Recibo ---------- */
function documentoRecibo(s) {
  const cli = DB.obter('clientes', s.clienteId) || {};
  const cfg = DB.config();
  const total = valorServico(s);
  const data = s.dataPagamento || s.dataConclusao || s.data;
  return `<div class="doc recibo">${cabecalhoDoc()}
    <div class="recibo-topo"><h2>Recibo nº ${s.numero}</h2><div class="recibo-valor">${moeda(total)}</div></div>
    <p class="recibo-texto">Recebi(emos) de <b>${esc(cli.nome || '')}</b>${cli.documento ? `, CPF/CNPJ ${esc(cli.documento)}` : ''},
      a importância de <b>${moeda(total)}</b> (${esc(valorPorExtenso(total))}), referente aos serviços abaixo,
      realizados em ${dataBR(s.data)}${enderecoCliente(cli) ? ` no endereço ${esc(enderecoCliente(cli))}` : ''}.</p>
    ${tabelaItensDoc(s.itens, s.desconto)}
    <p><b>Forma de pagamento:</b> ${esc(s.forma || '')}${s.pago ? '' : ' <b>(pagamento pendente)</b>'}</p>
    ${fimGarantia(s) ? `<p><b>Garantia:</b> até ${dataBR(fimGarantia(s))}.</p>` : ''}
    <p style="margin-top:24px">${esc(cfg.cidade || '')}${cfg.cidade ? ', ' : ''}${dataExtenso(data)}.</p>
    <div class="assinatura"><div>${esc(cfg.responsavel || nomeEmpresa())}<br>${esc(nomeEmpresa())}${cfg.cnpj ? '<br>CNPJ ' + esc(cfg.cnpj) : ''}</div></div>
  </div>`;
}
function tabelaItensDoc(itens, desconto) {
  const lista = (itens || []).filter((i) => i.descricao || i.valor);
  if (!lista.length) return '';
  const sub = subtotalItens(lista);
  return `<table class="tabela-itens"><thead><tr><th>Descrição</th><th class="num">Qtd.</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead><tbody>
    ${lista.map((i) => `<tr><td>${esc(i.descricao)}</td><td class="num">${esc(String(i.quantidade || 1).replace('.', ','))}</td>
      <td class="num">${moeda(i.valor)}</td><td class="num">${moeda((Number(i.quantidade) || 1) * (Number(i.valor) || 0))}</td></tr>`).join('')}
    </tbody><tfoot>
    ${Number(desconto) ? `<tr><td colspan="3" class="num">Subtotal</td><td class="num">${moeda(sub)}</td></tr>
      <tr><td colspan="3" class="num">Desconto</td><td class="num">- ${moeda(desconto)}</td></tr>` : ''}
    <tr><th colspan="3" class="num">Total</th><th class="num">${moeda(Math.max(0, sub - (Number(desconto) || 0)))}</th></tr></tfoot></table>`;
}
function dataExtenso(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1].toLowerCase()} de ${a}`;
}

/* ---------- Valor por extenso ---------- */
function valorPorExtenso(valor) {
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
    'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (n) => {
    if (n === 100) return 'cem';
    const partes = [];
    if (n >= 100) { partes.push(C[Math.floor(n / 100)]); n %= 100; }
    if (n >= 20) { partes.push(D[Math.floor(n / 10)]); n %= 10; }
    if (n > 0) partes.push(U[n]);
    return partes.join(' e ');
  };
  const inteiro = (n) => {
    if (n === 0) return 'zero';
    const grupos = [];
    const nomes = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
    let i = 0;
    while (n > 0) {
      const g = n % 1000;
      if (g) grupos.unshift({ g, i });
      n = Math.floor(n / 1000);
      i++;
    }
    return grupos.map(({ g, i: k }, j) => {
      let t = k === 1 && g === 1 ? 'mil' : ate999(g) + (k ? ' ' + nomes[k][g === 1 ? 0 : 1] : '');
      // "e" antes do último grupo quando ele é menor que 100 ou centena exata (ex.: mil e cem, mil e vinte)
      if (j > 0 && j === grupos.length - 1 && (g < 100 || g % 100 === 0)) t = 'e ' + t;
      return t;
    }).join(' ').replace(/\s+/g, ' ');
  };
  const total = Math.round((Number(valor) || 0) * 100);
  const reais = Math.floor(total / 100), centavos = total % 100;
  const partes = [];
  if (reais) partes.push(`${inteiro(reais)} ${reais === 1 ? 'real' : (reais % 1000000 === 0 ? 'de reais' : 'reais')}`);
  if (centavos) partes.push(`${inteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return partes.join(' e ') || 'zero reais';
}

/* ---------- Orçamento ---------- */
async function documentoOrcamento(o) {
  const cli = DB.obter('clientes', o.clienteId) || {};
  const cfg = DB.config();
  const fotos = o.fotos || [];
  const urls = fotos.length ? await urlsFotos(fotos.map((f) => f.caminho)) : {};
  const comUrl = fotos.filter((f) => urls[f.caminho]);
  return `<div class="doc">${cabecalhoDoc()}
    <h2>Orçamento nº ${o.numero}</h2>
    ${blocoClienteDoc(cli)}
    <div class="info" style="margin:4px 0 10px"><div><b>Data:</b> ${dataBR(o.data)}</div>
      <div><b>Validade:</b> ${o.validadeDias ? `${o.validadeDias} dias (até ${dataBR(somarDias(o.data, o.validadeDias))})` : '—'}</div></div>
    ${o.descricao ? `<h3>Descrição do serviço</h3><p style="white-space:pre-line">${esc(o.descricao)}</p>` : ''}
    ${comUrl.length ? `<h3>Fotos da visita</h3><div class="fotos-orc">${comUrl.map((f) => `<figure>
      <img src="${esc(urls[f.caminho])}" alt="">${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
    <h3>Valores</h3>
    ${tabelaItensDoc(o.itens, o.desconto)}
    ${o.pagamento ? `<p><b>Condições de pagamento:</b> ${esc(o.pagamento)}</p>` : ''}
    ${o.garantiaDias ? `<p><b>Garantia:</b> ${o.garantiaDias} dias após a execução.</p>` : ''}
    ${o.obs ? `<p style="white-space:pre-line"><b>Observações:</b> ${esc(o.obs)}</p>` : ''}
    <div class="assinatura"><div>${esc(cfg.responsavel || nomeEmpresa())}<br>${esc(nomeEmpresa())}</div><div>De acordo: ${esc(cli.nome || 'Cliente')}</div></div>
  </div>`;
}
