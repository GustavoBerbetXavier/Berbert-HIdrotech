// Berbert Hidrotech - app de controle dos serviços de desentupimento.
// Este arquivo tem os utilitários usados por todas as telas. As telas ficam em
// clientes.js, servicos.js, orcamentos.js, financeiro.js e inicio.js (menu e login).

/* ---------- Utilitários ---------- */
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moeda = (v) => fmtMoeda.format(Number(v) || 0);
// Aceita "1.250,50", "1250,5" e "1250.50".
const num = (v) => {
  let s = String(v ?? '').trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const valorCampo = (v) => (v || v === 0 ? String(Number(v).toFixed(2)).replace('.', ',') : '');
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const digitos = (s) => String(s || '').replace(/\D/g, '');

function isoData(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const hojeISO = () => isoData(new Date());
function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return isoData(new Date(a, m - 1, d + Number(dias || 0)));
}
function somarMeses(iso, meses) {
  const [a, m, d] = iso.split('-').map(Number);
  const ultimoDia = new Date(a, m - 1 + Number(meses) + 1, 0).getDate();
  return isoData(new Date(a, m - 1 + Number(meses), Math.min(d, ultimoDia)));
}
function diasEntre(de, ate) {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86400000);
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const nomeMes = (am) => { const [a, m] = am.split('-').map(Number); return `${MESES[m - 1]} de ${a}`; };
const mesAbrev = (am) => MESES[Number(am.slice(5, 7)) - 1].slice(0, 3);
function somarMesAM(am, n) {
  const [a, m] = am.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Telefones de um texto como "(44) 9996-9000 / 99927-2046" -> [{ texto, numero (com DDD) }]
function extrairTelefones(texto) {
  const ddd = digitos(DB.config().telefone).replace(/^55(?=\d{10,11}$)/, '').slice(0, 2) || '44';
  const achados = String(texto || '').match(/(\(?\d{2}\)?[\s.-]*)?9?\s?\d{4}[\s.-]?\d{4}/g) || [];
  const vistos = new Set();
  return achados.map((t) => {
    let n = digitos(t).replace(/^0+/, '').replace(/^55(?=\d{10,11}$)/, '');
    if (n.length === 8 || n.length === 9) n = ddd + n;
    return { texto: t.trim(), numero: n };
  }).filter((t) => (t.numero.length === 10 || t.numero.length === 11) && !vistos.has(t.numero) && vistos.add(t.numero));
}
const linkWhats = (numero, msg) => `https://wa.me/55${numero}?text=${encodeURIComponent(msg)}`;
const preencherMsg = (modelo, campos) => modelo.replace(/\{(\w+)\}/g, (_, k) => campos[k] ?? '');
// Abre a conversa do WhatsApp com o cliente (celular, se houver) e a mensagem pronta.
function abrirWhats(telefone, msg) {
  const fones = extrairTelefones(telefone);
  const celular = fones.find((f) => f.numero.length === 11) || fones[0];
  window.open(celular ? linkWhats(celular.numero, msg) : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}
const nomeEmpresa = () => DB.config().empresa || 'Berbert Hidrotech';

function lerForm(form) {
  const obj = {};
  new FormData(form).forEach((v, k) => (obj[k] = typeof v === 'string' ? v.trim() : v));
  $$('input[type=checkbox][name]:not([data-grupo])', form).forEach((cb) => (obj[cb.name] = cb.checked));
  return obj;
}
function campo(rotulo, nome, valor = '', tipo = 'text', extra = '') {
  const cls = extra.includes('full') ? 'full' : '';
  const attrs = extra.replace('full', '');
  if (tipo === 'textarea') return `<label class="${cls}">${rotulo}<textarea name="${nome}" ${attrs}>${esc(valor)}</textarea></label>`;
  if (tipo === 'dinheiro') {
    return `<label class="${cls}">${rotulo}<input type="text" inputmode="decimal" name="${nome}" value="${esc(valorCampo(valor))}" placeholder="0,00" ${attrs}></label>`;
  }
  return `<label class="${cls}">${rotulo}<input type="${tipo}" name="${nome}" value="${esc(valor)}" ${attrs}></label>`;
}
const opcoesSimples = (lista, atual) => lista.map((o) => {
  const [v, r] = Array.isArray(o) ? o : [o, o];
  return `<option value="${esc(v)}" ${String(v) === String(atual ?? '') ? 'selected' : ''}>${esc(r)}</option>`;
}).join('');
// Grupo de opções para marcar. 'marcados' é a lista do que já estava marcado;
// o que estiver marcado e não existir nas opções aparece também (marcado).
function grupoMarcar(nome, opcoesLista, marcados = [], colunas = '') {
  const sel = new Set((marcados || []).map(normalizar));
  const extras = (marcados || []).filter((m) => !opcoesLista.some((o) => normalizar(o) === normalizar(m)));
  return `<div class="grupo-marcar ${colunas}">${[...opcoesLista, ...extras].map((o) => `<label class="opcao-marcar"><input type="checkbox" data-grupo="${nome}" value="${esc(o)}"
    ${sel.has(normalizar(o)) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
}
const lerGrupo = (raiz, nome) => $$(`[data-grupo="${nome}"]:checked`, raiz).map((c) => c.value);
// Escolha única em botões grandes (bom para o dedo no celular).
function botoesEscolha(nome, lista, atual) {
  return `<div class="escolha" data-escolha="${nome}">${lista.map(([v, r, cor]) => `<label class="escolha-op ${cor || ''}">
    <input type="radio" name="${nome}" value="${esc(v)}" ${v === atual ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}</div>`;
}

function confirmar(msg) {
  return window.confirm(msg);
}
function avisar(msg, tipo = 'ok', duracao) {
  const el = $('#aviso-flutuante');
  el.textContent = msg;
  el.className = tipo;
  el.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => (el.hidden = true), duracao || (tipo === 'erro' ? 6000 : 2500));
}
// Executa uma ação assíncrona travando o botão enquanto trabalha.
async function enviando(botao, acao, textoEspera = 'Salvando...') {
  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoEspera;
  try {
    await acao();
  } catch (e) {
    avisar(e.message || String(e), 'erro');
  } finally {
    if (botao.isConnected) { botao.disabled = false; botao.textContent = texto; }
  }
}
function tag(texto, cor = 'cinza') {
  return `<span class="tag ${cor}">${esc(texto)}</span>`;
}
function baixarArquivo(conteudo, nome, tipo) {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
// Tela com alterações não salvas: { sujo(), descartar() }. Pergunta antes de sair dela.
let protegerSaida = null;
// Lembra a escolha de filtros/abas enquanto o app está aberto.
const estados = {};
const estado = (nome, padrao) => (estados[nome] = estados[nome] || { ...padrao });

/* ---------- Ícones (SVG) ---------- */
const ICONES = {
  inicio: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
  servicos: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  orcamentos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  financeiro: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  gastos: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  manutencao: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5M12 7v5l3 2"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  conta: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  senha: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  seta: '<path d="m18 15-6-6-6 6"/>',
  nuvem: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>',
};
const icone = (nome) => `<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;

/* ---------- Modal ---------- */
function abrirModal(titulo, html, aoMontar) {
  $('#modal-titulo').textContent = titulo;
  $('#modal-corpo').innerHTML = html;
  $('#modal').hidden = false;
  if (aoMontar) aoMontar($('#modal-corpo'));
  const primeiro = $('#modal-corpo input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([disabled]), #modal-corpo select');
  if (primeiro && window.matchMedia('(min-width: 800px)').matches) primeiro.focus();
}
function fecharModal() {
  $('#modal').hidden = true;
  $('#modal-corpo').innerHTML = '';
}
$('#modal-fechar').addEventListener('click', fecharModal);
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') fecharModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) fecharModal(); });

/* ---------- Fotos ---------- */
// Reduz a foto (no máximo 1600 px, JPEG) antes de enviar: fica leve e rápida de abrir.
async function comprimirFoto(arquivo) {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
}

/* ---------- Documentos: imprimir, PDF e WhatsApp ---------- */
function imprimir(html) {
  const area = $('#impressao');
  area.innerHTML = html;
  document.body.classList.add('imprimindo');
  const imagens = $$('img', area).filter((img) => !img.complete);
  Promise.all(imagens.map((img) => new Promise((ok) => { img.onload = img.onerror = ok; })))
    .then(() => setTimeout(() => window.print(), 50));
}
window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo'));

let carregandoPdf = null;
function carregarGeradorPdf() {
  if (window.html2pdf) return Promise.resolve();
  carregandoPdf = carregandoPdf || new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/html2pdf.bundle.min.js';
    s.onload = ok;
    s.onerror = () => { carregandoPdf = null; falha(new Error('não foi possível carregar o gerador de PDF.')); };
    document.head.appendChild(s);
  });
  return carregandoPdf;
}
async function gerarPdf(html) {
  await carregarGeradorPdf();
  const caixa = document.createElement('div');
  caixa.className = 'pdf-temporario';
  caixa.innerHTML = html;
  document.body.appendChild(caixa);
  try {
    await Promise.all($$('img', caixa).map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
    return await window.html2pdf().set({
      margin: [8, 8, 8, 8], image: { type: 'jpeg', quality: 0.9 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['figure', 'tr', '.info', '.assinatura'] },
    }).from($('.doc', caixa)).outputPdf('blob');
  } finally {
    caixa.remove();
  }
}
const nomeArquivo = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
// Gera o PDF. No celular abre o compartilhamento (escolhe o WhatsApp e o PDF vai anexado);
// no computador baixa o PDF e abre a conversa com o cliente, com a mensagem pronta.
async function enviarPdfWhatsApp({ html, arquivo, mensagem, telefone, botao }) {
  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Gerando PDF...';
  try {
    const blob = await gerarPdf(await html);
    const nome = nomeArquivo(arquivo) + '.pdf';
    const file = new File([blob], nome, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: mensagem, title: nome });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    baixarArquivo(blob, nome);
    abrirWhats(telefone, mensagem);
    avisar(`O PDF "${nome}" foi baixado. No WhatsApp, toque no clipe (anexar) e escolha o arquivo.`, 'ok', 9000);
  } catch (err) {
    avisar('Não foi possível gerar o PDF: ' + err.message, 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = texto;
  }
}
function cabecalhoDoc() {
  const c = DB.config();
  return `<div class="doc-topo">
    <div><img src="img/logo-escura.webp" alt="Berbert Hidrotech" class="doc-logo">
      <div class="dados">${esc(nomeEmpresa())}${c.cnpj ? ' — CNPJ: ' + esc(c.cnpj) : ''}</div></div>
    <div class="dados" style="text-align:right">${esc(c.endereco || '')}<br>${esc(c.telefone || '')}<br>${esc(c.email || '')}</div>
  </div>`;
}
