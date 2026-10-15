(() => {
  const KEY = 'malbidoll_carrinho_v1';
  let itens = [];
  
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(v)) {
      itens = v.filter(x => Number.isInteger(x.id) && x.id > 0 && Number.isInteger(x.qtd) && x.qtd > 0).slice(0, 100);
    }
  } catch {}

  const $ = id => document.getElementById(id);
  const painel = $('carrinhoPainel');
  const fundo = $('carrinhoFundo');
  const lista = $('listaCarrinho');

  if (!painel || !fundo || !lista) return;

  const dinheiro = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const salvar = () => { 
    localStorage.setItem(KEY, JSON.stringify(itens)); 
    render(); 
  };
  
  const abrir = () => {
    painel.classList.add('aberto');
    painel.setAttribute('aria-hidden', 'false');
    fundo.hidden = false;
    document.body.classList.add('carrinho-aberto');
    $('fecharCarrinho').focus();
  };

  const fechar = () => {
    painel.classList.remove('aberto');
    painel.setAttribute('aria-hidden', 'true');
    fundo.hidden = true;
    document.body.classList.remove('carrinho-aberto');
  };

  function render() {
    lista.replaceChildren();
    let total = 0, quantidade = 0;

    if (!itens.length) {
      const p = document.createElement('p');
      p.className = 'estado-vazio';
      p.textContent = 'Seu carrinho está vazio por enquanto ♡';
      lista.append(p);
    }

    itens.forEach(i => {
      total += i.preco * i.qtd;
      quantidade += i.qtd;

      const row = document.createElement('div');
      row.className = 'carrinho-item';

      const img = document.createElement('img');
      img.src = i.imagem;
      img.alt = '';

      const info = document.createElement('div');
      
      const title = document.createElement('strong');
      title.textContent = i.nome;

      const price = document.createElement('p');
      price.textContent = dinheiro(i.preco);

      const actions = document.createElement('div');
      actions.className = 'carrinho-acoes';

      const minus = document.createElement('button');
      minus.textContent = '−';
      minus.setAttribute('aria-label', 'Diminuir quantidade');
      minus.onclick = () => {
        i.qtd--;
        if (!i.qtd) itens = itens.filter(x => x !== i);
        salvar();
      };

      const qty = document.createElement('span');
      qty.textContent = i.qtd;

      const plus = document.createElement('button');
      plus.textContent = '+';
      plus.setAttribute('aria-label', 'Aumentar quantidade');
      plus.onclick = () => {
        if (i.qtd < 99) {
          i.qtd++;
          salvar();
        }
      };

      const del = document.createElement('button');
      del.textContent = 'Remover';
      del.className = 'remover-carrinho';
      del.onclick = () => {
        itens = itens.filter(x => x !== i);
        salvar();
      };

      actions.append(minus, qty, plus, del);
      info.append(title, price, actions);
      row.append(img, info);
      lista.append(row);
    });

    $('totalCarrinho').textContent = dinheiro(total);
    $('contadorCarrinho').textContent = quantidade;
    
    document.querySelectorAll('[data-carrinho-contagem]').forEach(el => {
      el.textContent = quantidade;
    });
  }

  document.querySelectorAll('[data-abrir-carrinho]').forEach(btn => {
    btn.addEventListener('click', abrir);
  });
  
  $('fecharCarrinho').addEventListener('click', fechar);
  fundo.addEventListener('click', fechar);
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fechar();
  });

  document.querySelectorAll('[data-adicionar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await fetch('/api/bonecas/' + btn.dataset.adicionar);
        if (!r.ok) throw Error();
        
        const b = await r.json();
        const atual = itens.find(x => x.id === b.id);
        
        if (atual) {
          atual.qtd = Math.min(99, atual.qtd + 1);
        } else {
          itens.push({ ...b, qtd: 1 });
        }
        
        salvar();
        abrir();
      } catch {
        alert('Não foi possível adicionar a boneca.');
      } finally {
        btn.disabled = false;
      }
    });
  });

  render();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
  });
})();