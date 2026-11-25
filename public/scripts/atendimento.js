(() => {
  const root = document.getElementById('malbiChat');
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const area = $('chatConteudo');
  const janela = $('chatJanela');
  const form = $('chatFormulario');
  const campo = $('chatTexto');
  const logado = root.dataset.login === 'sim';
  const csrf = root.dataset.csrf;
  const parametros = new URLSearchParams(location.search);
  const pedidoInicial = parametros.get('atendimento_pedido');
  const chatInicial = parametros.get('atendimento_id');
  const fotos = $('chatFotos');
  let tipoAtual = 'geral';
  const resumoFotos = $('chatFotosResumo');
  let atual = null;
  let aberto = false;
  let enviando = false;
  let pedidos = [];
  let pedidoSelecionado = pedidoInicial || '';

  const elemento = (tag, texto, classe) => {
    const node = document.createElement(tag);
    if (texto !== undefined) node.textContent = texto;
    if (classe) node.className = classe;
    return node;
  };

  async function api(url, method = 'GET', body) {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a operação.');
    return data;
  }

  function aviso(mensagem) {
    area.append(elemento('p', mensagem, 'malbi-chat-erro'));
  }

  async function carregarPedidos() {
    try {
      pedidos = await api('/api/atendimentos/pedidos');
    } catch (error) {
      pedidos = [];
      aviso(error.message);
    }
  }

  function seletorPedido(pedidoAtual) {
    const grupo = elemento('label', 'Número do pedido (opcional)', 'malbi-chat-pedido');
    const select = elemento('select');
    const vazio = elemento('option', pedidos.length ? 'Nenhum pedido selecionado' : 'Nenhum pedido realizado');
    vazio.value = '';
    select.append(vazio);
    pedidos.forEach((pedido) => {
      const data = new Date(pedido.criado_em).toLocaleDateString('pt-BR');
      const option = elemento('option', `#${pedido.numero} — ${data}`);
      option.value = String(pedido.id);
      select.append(option);
    });
    select.value = pedidos.some((pedido) => String(pedido.id) === String(pedidoAtual))
      ? String(pedidoAtual)
      : '';
    select.disabled = !pedidos.length;
    select.addEventListener('change', async () => {
      const anterior = pedidoSelecionado;
      pedidoSelecionado = select.value;
      if (!atual) return;
      try {
        await api(`/api/atendimentos/${atual}/pedido`, 'POST', {
          pedido_id: pedidoSelecionado || null
        });
      } catch (error) {
        pedidoSelecionado = anterior;
        select.value = anterior;
        aviso(error.message);
      }
    });
    grupo.append(select);
    return grupo;
  }

  function mostrarMensagens(mensagens) {
    const lista = elemento('div', undefined, 'malbi-chat-mensagens');
    if (!mensagens.length) {
      lista.append(elemento('p', 'Olá! 💚 Como podemos ajudar?'));
    }
    mensagens.forEach((mensagem) => {
      const minha = String(mensagem.autor_id) === root.dataset.user;
      const bolha = elemento('div', mensagem.mensagem, `malbi-chat-mensagem${minha ? ' minha' : ''}`);
      if (!minha) bolha.prepend(elemento('strong', 'Malbi Doll ✓', 'malbi-oficial'));
      (mensagem.anexos || []).forEach((foto) => {
        const link = elemento('a', foto.nome, 'malbi-foto-link');
        link.href = `/api/atendimentos/${atual}/anexos/${foto.id}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const img = elemento('img');
        img.src = link.href;
        img.alt = foto.nome;
        img.loading = 'lazy';
        link.replaceChildren(img);
        bolha.append(link);
      });
      bolha.append(elemento('small', new Date(mensagem.criado_em).toLocaleString('pt-BR')));
      lista.append(bolha);
    });
    area.append(lista);
    area.scrollTop = area.scrollHeight;
  }

  async function mostrarConversa() {
    const focado = document.activeElement === campo;
    const posicao = area.scrollTop;
    const noFim = area.scrollHeight - area.scrollTop - area.clientHeight < 70;
    const dados = atual ? await api(`/api/atendimentos/${atual}`) : null;
    area.replaceChildren();
    tipoAtual = dados?.atendimento.tipo || 'geral';
    if (tipoAtual === 'reembolso') {
      area.append(elemento('h3', 'Reembolso · Atendimento oficial Malbi Doll'));
    } else {
      area.append(seletorPedido(dados?.atendimento.pedido_id || pedidoSelecionado));
    }
    $('chatAnexarLabel').hidden = tipoAtual !== 'reembolso';
    fotos.value = '';
    resumoFotos.hidden = true;
    mostrarMensagens(dados?.mensagens || []);
    form.hidden = false;
    $('chatVoltar').hidden = false;
    if (!noFim) area.scrollTop = posicao;
    if (focado) campo.focus();
  }

  function botao(rotulo, acao, classe = 'malbi-chat-acao') {
    const item = elemento('button', rotulo, classe);
    item.type = 'button';
    item.addEventListener('click', acao);
    return item;
  }

  async function listar() {
    atual = null;
    area.replaceChildren();
    form.hidden = true;
    $('chatVoltar').hidden = true;
    const conversas = await api('/api/atendimentos');
    area.append(elemento('h3', 'Meus atendimentos'));
    area.append(botao('+ Novo atendimento', novoAtendimento));
    if (!conversas.length) area.append(elemento('p', 'Nenhum atendimento ainda.'));
    conversas.forEach((conversa) => {
      const item = botao(`#${conversa.id} · ${conversa.assunto} · ${conversa.status.replaceAll('_', ' ')}`, async () => {
        atual = conversa.id;
        pedidoSelecionado = conversa.pedido_id || '';
        await mostrarConversa();
      }, 'malbi-chat-item');
      area.append(item);
    });
  }

  function novoAtendimento() {
    atual = null;
    pedidoSelecionado = pedidoInicial || '';
    area.replaceChildren();
    $('chatVoltar').hidden = false;
    area.append(elemento('label', 'Assunto do atendimento', 'malbi-chat-pedido'));
    const assunto = elemento('input');
    assunto.id = 'chatAssunto';
    assunto.maxLength = 100;
    assunto.placeholder = 'Ex.: Dúvida sobre entrega';
    assunto.required = true;
    area.append(assunto, seletorPedido(pedidoSelecionado));
    form.hidden = false;
    campo.focus();
  }

  async function iniciar() {
    area.replaceChildren();
    form.hidden = true;
    if (!logado) {
      area.append(elemento('p', 'Entre na sua conta para conversar com a loja.'));
      const link = elemento('a', 'Entrar ou criar conta');
      link.href = `/login?retorno=${encodeURIComponent(location.pathname + location.search)}`;
      area.append(link);
      return;
    }
    try {
      await carregarPedidos();
      if (chatInicial && /^\d+$/.test(chatInicial)) {
        const conversas = await api('/api/atendimentos');
        if (conversas.some(c => String(c.id) === chatInicial)) {
          atual = chatInicial;
          await mostrarConversa();
        } else {
          await listar();
        }
      } else if (pedidoInicial) novoAtendimento();
      else await listar();
    } catch (error) {
      aviso(error.message);
    }
  }

  async function enviar(event) {
    event.preventDefault();
    const mensagem = campo.value.trim();
    if ((!mensagem && !fotos.files.length) || enviando) return;
    enviando = true;
    const botao = form.querySelector('[type="submit"]');
    botao.disabled = true;
    try {
      if (!atual) {
        const conversa = await api('/api/atendimentos', 'POST', {
          assunto: $('chatAssunto')?.value.trim() || '',
          pedido_id: pedidoSelecionado || null
        });
        atual = conversa.id;
      }
      if (tipoAtual === 'reembolso') {
        const corpo = new FormData();
        corpo.append('mensagem', mensagem);
        [...fotos.files].forEach((foto) => corpo.append('fotos', foto));
        const resposta = await fetch(`/api/atendimentos/${atual}/fotos`, {
          method: 'POST',
          headers: { 'x-csrf-token': csrf },
          body: corpo
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível enviar.');
      } else {
        await api(`/api/atendimentos/${atual}/mensagens`, 'POST', { mensagem });
      }
      fotos.value = '';
      resumoFotos.hidden = true;
      campo.value = '';
      await mostrarConversa();
      $('chatVoltar').hidden = false;
      campo.focus();
    } catch (error) {
      aviso(error.message);
    } finally {
      enviando = false;
      botao.disabled = false;
    }
  }

  function abrir() {
    aberto = true;
    janela.hidden = false;
    $('chatAlternar').setAttribute('aria-expanded', 'true');
    iniciar();
  }

  function fechar() {
    aberto = false;
    janela.hidden = true;
    $('chatAlternar').setAttribute('aria-expanded', 'false');
  }

  fotos.addEventListener('change', () => {
    if (fotos.files.length > 5 || [...fotos.files].some(f => f.size > 5 * 1024 * 1024)) {
      alert('Selecione até 5 fotos de no máximo 5 MB.');
      fotos.value = '';
    }
    resumoFotos.textContent = fotos.files.length ? `${fotos.files.length} foto(s)` : '';
    resumoFotos.hidden = !fotos.files.length;
    campo.required = !fotos.files.length;
    const resumo = document.getElementById('chatFotosResumo');
    resumo.querySelectorAll('img').forEach(img => img.remove());
    [...fotos.files].forEach(foto => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(foto);
      img.alt = foto.name;
      img.className = 'malbi-miniatura-anexo';
      img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });
      resumo.append(img);
    });
  });
  form.addEventListener('submit', enviar);
  campo.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (campo.value.trim() || fotos.files.length) form.requestSubmit();
    }
  });
  $('chatAlternar').addEventListener('click', () => aberto ? fechar() : abrir());
  $('chatVoltar').addEventListener('click', () => listar().catch((error) => aviso(error.message)));
  $('chatMinimizar').addEventListener('click', fechar);
  $('chatFechar').addEventListener('click', fechar);
  document.querySelectorAll('[data-abrir-atendimento]').forEach((botao) => {
    botao.addEventListener('click', abrir);
  });
  if (parametros.has('abrir_atendimento')) abrir();

  setInterval(async () => {
    if (!aberto || !atual || document.hidden || enviando) return;
    try {
      await mostrarConversa();
    } catch { /* A próxima atualização tentará novamente. */ }
  }, 15000);

  async function notificacoes() {
    if (!logado || document.hidden) return;
    try {
      const conversas = await api('/api/atendimentos');
      $('chatNotificacao').hidden = !conversas.some((conversa) => conversa.nao_lidas > 0);
    } catch { /* Mantém o estado anterior. */ }
  }
  notificacoes();
  setInterval(notificacoes, 45000);
})();
