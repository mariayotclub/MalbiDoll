(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.atdConfig;
  let atual = null;
  let carregando = false;
  let tipoAtual = 'geral';
  const fotos = $('atdFotos');

  function texto(tag, valor, classe) {
    const elemento = document.createElement(tag);
    elemento.textContent = valor;
    if (classe) elemento.className = classe;
    return elemento;
  }

  async function api(url, method = 'GET', body) {
    const resposta = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': config.csrf },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || 'Falha ao atualizar.');
    return dados;
  }

  async function selecionar(id) {
    if (carregando) return;
    carregando = true;
    atual = id;
    document.querySelectorAll('.atd-item').forEach((botao) => {
      botao.classList.toggle('ativo', botao.dataset.id === String(id));
    });

    const cabecalho = $('atdCabecalho');
    const mensagens = $('atdMensagens');
    const detalhes = $('atdDetalhes');
    try {
      const dados = await api(`/api/atendimentos/${id}`);
      tipoAtual = dados.atendimento.tipo || 'geral';
      $('atdAnexarLabel').hidden = tipoAtual !== 'reembolso';
      fotos.value = '';
      $('atdFotosResumo').textContent = '';
      $('atdTexto').required = true;
      const botao = document.querySelector(`.atd-item[data-id="${id}"]`);
      cabecalho.replaceChildren();
      mensagens.replaceChildren();
      detalhes.replaceChildren();
      cabecalho.append(texto('h2', botao.dataset.cliente));

      const status = texto('div', '', 'atd-status');
      const seletor = document.createElement('select');
      [
        ['aberto', 'Aberto'],
        ['em_andamento', 'Em andamento'],
        ['aguardando_cliente', 'Aguardando cliente'],
        ['resolvido', 'Resolvido']
      ].forEach(([valor, rotulo]) => {
        const opcao = texto('option', rotulo);
        opcao.value = valor;
        seletor.append(opcao);
      });
      seletor.value = dados.atendimento.status;
      const salvar = texto('button', 'Salvar status');
      salvar.type = 'button';
      salvar.addEventListener('click', async () => {
        try {
          await api(`/api/atendimentos/${id}/status`, 'POST', { status: seletor.value });
          botao.dataset.status = seletor.value;
          carregando = false;
          await selecionar(id);
        } catch (error) {
          alert(error.message);
        }
      });
      status.append(seletor, salvar);
      cabecalho.append(status);

      detalhes.append(texto('h3', 'Informações do atendimento'));

      const informacoes = document.createElement('div');
      informacoes.className = 'atd-detalhes-info';
      informacoes.append(texto('strong', botao.dataset.cliente));
      informacoes.append(texto('p', `Atendimento #${id}`));
      informacoes.append(texto('p', botao.dataset.pedido
        ? `Pedido #${botao.dataset.pedido}`
        : 'Nenhum pedido vinculado'));
      informacoes.append(texto('p', `Status: ${seletor.options[seletor.selectedIndex].text}`));
      detalhes.append(informacoes);

      const configuracoes = document.createElement('div');
      configuracoes.className = 'atd-detalhes-config';
      configuracoes.append(texto('h4', 'Permissões e restrições'));

      const excecao = document.createElement('label');
      excecao.className = 'atd-checkbox';
      const liberar = document.createElement('input');
      liberar.type = 'checkbox';
      liberar.checked = botao.dataset.semLimites === 'true';
      excecao.append(liberar, document.createTextNode('Isentar dos limites de atendimento'));

      const rotulo = texto('label', 'Restringir mensagens por');
      rotulo.className = 'atd-campo';
      const bloqueio = document.createElement('select');
      [
        [0, 'Sem restrição'],
        [1, '1 dia'],
        [3, '3 dias'],
        [5, '5 dias'],
        [7, '7 dias']
      ].forEach(([valor, descricao]) => {
        const opcao = texto('option', descricao);
        opcao.value = String(valor);
        bloqueio.append(opcao);
      });

      const bloqueadoAte = botao.dataset.bloqueado;
      const bloqueioAtivo = bloqueadoAte && new Date(bloqueadoAte) > new Date();
      if (bloqueioAtivo) {
        const termino = texto('p',
          `Restrição atual até ${new Date(bloqueadoAte).toLocaleString('pt-BR')}`,
          'atd-restricao-atual');
        configuracoes.append(termino);
      }
      rotulo.append(bloqueio);

      const aplicar = texto('button', 'Salvar exceções');
      aplicar.type = 'button';
      aplicar.className = 'atd-salvar-excecoes';
      aplicar.addEventListener('click', async () => {
        aplicar.disabled = true;
        try {
          const resultado = await api(`/api/admin/atendimento/excecoes/${botao.dataset.usuario}`, 'POST', {
            sem_limites: liberar.checked,
            bloqueio_dias: Number(bloqueio.value)
          });
          document.querySelectorAll(`.atd-item[data-usuario="${botao.dataset.usuario}"]`)
            .forEach((item) => {
              item.dataset.semLimites = String(resultado.sem_limites);
              item.dataset.bloqueado = resultado.bloqueado_ate || '';
            });
          await selecionar(id);
        } catch (error) {
          alert(error.message);
        } finally {
          aplicar.disabled = false;
        }
      });
      configuracoes.append(excecao, rotulo, aplicar);
      detalhes.append(configuracoes);


      dados.mensagens.forEach((mensagem) => {
        const minha = Number(mensagem.autor_id) === Number(config.usuario);
        const bolha = texto('div', mensagem.mensagem, `atd-msg${minha ? ' minha' : ''}`);
        if (minha) bolha.prepend(texto('strong', 'Malbi Doll ✓', 'malbi-oficial'));
        (mensagem.anexos || []).forEach((foto) => {
          const link = document.createElement('a');
          link.href = `/api/atendimentos/${atual}/anexos/${foto.id}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          const img = document.createElement('img');
          img.src = link.href;
          img.alt = foto.nome;
          img.loading = 'lazy';
          link.append(img);
          bolha.append(link);
        });
        bolha.append(texto('small', new Date(mensagem.criado_em).toLocaleString('pt-BR')));
        mensagens.append(bolha);
      });
      mensagens.scrollTop = mensagens.scrollHeight;
      $('atdForm').hidden = dados.atendimento.status === 'resolvido';
    } catch (error) {
      mensagens.replaceChildren(texto('p', error.message));
    } finally {
      carregando = false;
    }
  }

  document.querySelectorAll('.atd-item').forEach((botao) => {
    botao.addEventListener('click', () => selecionar(botao.dataset.id));
  });
  $('atdBusca').addEventListener('input', (event) => {
    const busca = event.target.value.toLowerCase();
    document.querySelectorAll('.atd-item').forEach((botao) => {
      botao.hidden = !(botao.textContent + ' ' + botao.dataset.pedido).toLowerCase().includes(busca);
    });
  });
  $('atdForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!atual || (!$('atdTexto').value.trim() && !fotos.files.length)) return;
    try {
      if (tipoAtual === 'reembolso') {
        const corpo = new FormData();
        corpo.append('mensagem', $('atdTexto').value.trim());
        [...fotos.files].forEach((foto) => corpo.append('fotos', foto));
        const resposta = await fetch(`/api/atendimentos/${atual}/fotos`, {
          method: 'POST',
          headers: { 'x-csrf-token': config.csrf },
          body: corpo
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.erro || 'Falha ao enviar fotos.');
      } else {
        await api(`/api/atendimentos/${atual}/mensagens`, 'POST', {
          mensagem: $('atdTexto').value
        });
      }
      fotos.value = '';
      $('atdTexto').value = '';
      await selecionar(atual);
    } catch (error) {
      alert(error.message);
    }
  });
  fotos.addEventListener('change', () => {
    if (fotos.files.length > 5 || [...fotos.files].some(f => f.size > 5 * 1024 * 1024)) {
      alert('Selecione até 5 fotos de no máximo 5 MB.');
      fotos.value = '';
    }
    $('atdFotosResumo').textContent = fotos.files.length ? `${fotos.files.length} foto(s)` : '';
    $('atdTexto').required = !fotos.files.length;
    const resumo = document.getElementById('atdFotosResumo');
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
  const reembolsoInicial = new URLSearchParams(location.search).get('reembolso_id');
  if (reembolsoInicial) {
    const item = [...document.querySelectorAll('.atd-item')]
      .find(botao => botao.dataset.reembolso === reembolsoInicial);
    if (item) selecionar(item.dataset.id);
  }
  $('atdTexto').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if ($('atdTexto').value.trim() || fotos.files.length) $('atdForm').requestSubmit();
    }
  });
})();
