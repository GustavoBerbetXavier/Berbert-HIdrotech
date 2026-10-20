// Camada de dados: login e armazenamento no Supabase.
// Os registros ficam em memória (e numa cópia no aparelho) para as telas serem rápidas
// e o app abrir mesmo sem internet. Cada alteração entra numa fila guardada no aparelho
// e é enviada ao banco assim que houver conexão: nada se perde se o sinal cair no serviço.
const DB = (() => {
  const COLECOES = ['clientes', 'servicos', 'orcamentos', 'lancamentos'];
  const CHAVE_COPIA = 'hidrotech-copia';
  const CHAVE_FILA = 'hidrotech-fila';

  let sb = null;
  let perfil = null;
  let usuario = null;
  let dados = vazio();
  let indices = {};
  let config = {};
  let pendentes = lerLocal(CHAVE_FILA, []);
  let enviandoFila = null;
  let aoErro = (msg) => alert(msg);
  let aoMudarFila = () => {};
  let ultimaCarga = 0;
  let offline = false;

  function vazio() {
    const base = {};
    COLECOES.forEach((c) => (base[c] = []));
    return base;
  }
  function lerLocal(chave, padrao) {
    try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
  }
  function gravarLocal(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch { return false; }
  }
  let contadorId = 0;
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    contadorId += 1;
    return Date.now().toString(36) + contadorId.toString(36) + Math.random().toString(36).slice(2, 10);
  }
  const semRede = (e) => /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(String((e && e.message) || e));
  function erroFotos(error) {
    const m = String((error && (error.message || error.error)) || error);
    if (/bucket not found|not found/i.test(m)) return 'a pasta de fotos ainda não foi criada. Execute o arquivo supabase/schema.sql no SQL Editor do Supabase.';
    if (/row-level security|unauthorized|403/i.test(m)) return 'sem permissão para enviar fotos.';
    if (/payload too large|exceeded|413/i.test(m)) return 'a foto é grande demais.';
    if (semRede(m)) return 'sem internet. Tire a foto de novo quando tiver sinal.';
    return m;
  }
  function configurado() {
    const c = window.HIDROTECH_CONFIG || {};
    return Boolean(c.supabaseUrl && c.supabaseAnonKey);
  }
  function traduzirErro(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Marque "Auto Confirm User" ao criar o login no Supabase (veja o README).';
    if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/row-level security|permission denied/i.test(m)) return 'Sem permissão para esta ação (login não liberado).';
    if (/Could not find the table|schema cache|relation .* does not exist/i.test(m)) return 'O banco de dados ainda não foi preparado. Rode o arquivo supabase/schema.sql no SQL Editor do Supabase (veja o README) e entre de novo.';
    if (semRede(m)) return 'Sem conexão com a internet.';
    return m;
  }

  /* ---------- Fila de envio ---------- */
  function guardarCopia() {
    gravarLocal(CHAVE_COPIA, { dados, config, em: Date.now(), usuario: usuario && usuario.id });
  }
  function guardarFila() {
    gravarLocal(CHAVE_FILA, pendentes);
    aoMudarFila(pendentes.length);
  }
  function enfileirar(op) {
    // Uma alteração nova do mesmo registro substitui a que ainda não foi enviada.
    pendentes = pendentes.filter((p) => !(p.col === op.col && p.id === op.id));
    pendentes.push(op);
    guardarFila();
    guardarCopia();
    enviarFila();
  }
  function enviarFila() {
    if (enviandoFila || !sb) return enviandoFila || Promise.resolve();
    enviandoFila = (async () => {
      while (pendentes.length) {
        const op = pendentes[0];
        const r = op.op === 'apagar'
          ? await sb.from(op.col).delete().eq('id', op.id)
          : await sb.from(op.col).upsert({ id: op.id, dados: op.dados, atualizado_em: op.em });
        if (r.error) {
          if (semRede(r.error)) { offline = true; aoMudarFila(pendentes.length); break; }
          aoErro('Não foi possível salvar no banco: ' + traduzirErro(r.error));
        }
        offline = false;
        pendentes = pendentes.filter((p) => p !== op);
        guardarFila();
      }
    })().catch((e) => { offline = semRede(e); aoMudarFila(pendentes.length); })
      .finally(() => { enviandoFila = null; });
    return enviandoFila;
  }
  window.addEventListener('online', () => enviarFila());
  setInterval(() => { if (pendentes.length) enviarFila(); }, 30000);

  // Aplica por cima dos dados do banco as alterações que ainda estão na fila.
  function aplicarPendentes(base) {
    for (const op of pendentes) {
      if (!base[op.col]) continue;
      base[op.col] = base[op.col].filter((x) => x.id !== op.id);
      if (op.op !== 'apagar') base[op.col].push({ ...op.dados, id: op.id });
    }
    return base;
  }

  async function carregarPerfil() {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) { perfil = null; usuario = null; return null; }
    usuario = s.session.user;
    try {
      const { data, error } = await sb.from('perfis').select('*').eq('id', usuario.id).maybeSingle();
      if (error) throw error;
      perfil = data || { id: usuario.id, email: usuario.email, ativo: false };
    } catch (e) {
      // Sem internet: usa a cópia guardada no aparelho, se for deste mesmo login.
      const copia = lerLocal(CHAVE_COPIA, null);
      if (!semRede(e) || !copia || copia.usuario !== usuario.id) throw e;
      perfil = { id: usuario.id, email: usuario.email, nome: (usuario.user_metadata || {}).nome || '', ativo: true };
      offline = true;
    }
    return perfil;
  }

  async function carregar() {
    try {
      await enviarFila();
      const novos = vazio();
      const PAGINA = 1000;
      await Promise.all(COLECOES.map(async (col) => {
        const linhas = [];
        for (let de = 0; ; de += PAGINA) {
          const r = await sb.from(col).select('id, dados').order('id').range(de, de + PAGINA - 1);
          if (r.error) throw r.error;
          linhas.push(...r.data);
          if (r.data.length < PAGINA) break;
        }
        novos[col] = linhas.map((l) => ({ ...l.dados, id: l.id }));
      }));
      const { data: cfgs, error } = await sb.from('config').select('chave, valor').eq('chave', 'empresa');
      if (error) throw error;
      dados = aplicarPendentes(novos);
      config = (cfgs && cfgs[0] && cfgs[0].valor) || {};
      offline = false;
      guardarCopia();
    } catch (e) {
      const copia = lerLocal(CHAVE_COPIA, null);
      if (!semRede(e) || !copia || (usuario && copia.usuario !== usuario.id)) throw e;
      dados = aplicarPendentes({ ...vazio(), ...copia.dados });
      config = copia.config || {};
      offline = true;
    }
    indices = {};
    ultimaCarga = Date.now();
    aoMudarFila(pendentes.length);
  }

  return {
    configurado,
    traduzirErro,
    definirAoErro: (fn) => (aoErro = fn),
    definirAoMudarFila: (fn) => (aoMudarFila = fn),
    perfil: () => perfil,
    usuario: () => usuario,
    pendentes: () => pendentes.length,
    offline: () => offline,

    /* ---------- Sessão ---------- */
    async iniciar() {
      const c = window.HIDROTECH_CONFIG;
      sb = supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { storageKey: 'hidrotech-login' } });
      return carregarPerfil();
    },
    async entrar(email, senha) {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error(traduzirErro(error));
      return carregarPerfil();
    },
    async sair() {
      if (pendentes.length && !window.confirm(`Ainda há ${pendentes.length} alteração(ões) esperando internet para ir ao banco. Se sair agora, elas serão perdidas. Sair mesmo assim?`)) return false;
      await sb.auth.signOut();
      perfil = null;
      usuario = null;
      dados = vazio();
      indices = {};
      config = {};
      pendentes = [];
      guardarFila();
      try { localStorage.removeItem(CHAVE_COPIA); } catch { /* sem armazenamento */ }
      return true;
    },
    async alterarMinhaSenha(senha) {
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) throw new Error(traduzirErro(error));
    },
    async alterarMeuNome(nome) {
      const { error } = await sb.from('perfis').update({ nome }).eq('id', perfil.id);
      if (error) throw new Error(traduzirErro(error));
      perfil = { ...perfil, nome };
    },
    async enviarRedefinicaoSenha(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
      if (error) throw new Error(traduzirErro(error));
    },
    carregar,
    enviarFila,
    carregadoHa: () => Date.now() - ultimaCarga,

    /* ---------- Fotos (Supabase Storage, pasta "fotos") ---------- */
    async enviarFoto(caminho, blob) {
      const { error } = await sb.storage.from('fotos').upload(caminho, await blob.arrayBuffer(), { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error(erroFotos(error));
    },
    // Endereços temporários (1 hora) para mostrar e imprimir as fotos.
    async urlsFotos(caminhos) {
      if (!caminhos.length) return {};
      const { data, error } = await sb.storage.from('fotos').createSignedUrls(caminhos, 3600);
      if (error) throw new Error(erroFotos(error));
      return Object.fromEntries((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
    },
    async removerFotos(caminhos) {
      if (!caminhos.length) return;
      const { error } = await sb.storage.from('fotos').remove(caminhos);
      if (error) throw new Error(erroFotos(error));
    },

    /* ---------- Registros ---------- */
    listar: (col) => dados[col].slice(),
    obter(col, id) {
      if (!id) return null;
      if (!indices[col]) indices[col] = new Map(dados[col].map((x) => [x.id, x]));
      return indices[col].get(id) || null;
    },
    salvarItem(col, item) {
      let final;
      const agora = new Date().toISOString();
      if (!item.id || !this.obter(col, item.id)) {
        final = { criadoEm: agora, ...item, id: item.id || uid() };
        dados[col].push(final);
      } else {
        const i = dados[col].findIndex((x) => x.id === item.id);
        final = { ...dados[col][i], ...item };
        dados[col][i] = final;
      }
      if (indices[col]) indices[col].set(final.id, final);
      const { id, ...resto } = final;
      enfileirar({ op: 'salvar', col, id, dados: resto, em: agora });
      return final;
    },
    remover(col, id) {
      dados[col] = dados[col].filter((x) => x.id !== id);
      if (indices[col]) indices[col].delete(id);
      enfileirar({ op: 'apagar', col, id, em: new Date().toISOString() });
    },
    // Próximo número (serviços, orçamentos, recibos): o maior número já usado + 1.
    proximoNumero(col) {
      return dados[col].reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1;
    },
    novoId: uid,

    /* ---------- Configurações ---------- */
    config: () => ({ ...config }),
    async salvarConfig(cfg) {
      const novo = { ...config, ...cfg };
      const { error } = await sb.from('config').upsert({ chave: 'empresa', valor: novo });
      if (error) throw new Error(traduzirErro(error));
      config = novo;
      guardarCopia();
    },

    /* ---------- Backup ---------- */
    exportar() {
      return JSON.stringify({ sistema: 'berbert-hidrotech', ...dados, config, exportadoEm: new Date().toISOString() }, null, 2);
    },
    async importar(texto) {
      const obj = JSON.parse(texto);
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj.clientes)) throw new Error('Arquivo de backup inválido');
      for (const col of COLECOES) {
        const linhas = (obj[col] || []).filter((x) => x && x.id).map(({ id, ...resto }) => ({ id: String(id), dados: resto }));
        for (let i = 0; i < linhas.length; i += 500) {
          const { error } = await sb.from(col).upsert(linhas.slice(i, i + 500));
          if (error) throw new Error(traduzirErro(error));
        }
      }
      if (obj.config && Object.keys(obj.config).length) await this.salvarConfig(obj.config);
      await carregar();
    },
    // Cadastra muitos registros de uma vez (importação de planilha de clientes).
    async adicionarVarios(col, itens) {
      const agora = new Date().toISOString();
      const novos = itens.map((i) => ({ ...i, id: uid(), criadoEm: agora }));
      for (let i = 0; i < novos.length; i += 500) {
        const lote = novos.slice(i, i + 500);
        const { error } = await sb.from(col).insert(lote.map(({ id, ...resto }) => ({ id, dados: resto })));
        if (error) throw new Error(traduzirErro(error));
        dados[col].push(...lote);
        if (indices[col]) lote.forEach((x) => indices[col].set(x.id, x));
      }
      guardarCopia();
      return novos;
    },
  };
})();
