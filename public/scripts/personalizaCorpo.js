import { associarPontos, buscarPontos, categoriaDeformavel, deformarRoupa } from './deformacaoSVG.js';

// O corpo só entra no pedido depois que seu SVG for carregado com sucesso.
const boneca = {};
const corpoPadrao = window.corpoPadrao;
let requisicaoCorpo = 0;
let corpoAtual = null;
const requisicoesItens = new Map();
const roupasSelecionadas = new Map();

function chaveItem(categoria, subcategoria) {
  return JSON.stringify([categoria, subcategoria]);
}

async function carregarPontosSeguro(id) {
  try {
    return await buscarPontos(id);
  } catch (erro) {
    console.warn('Não foi possível carregar as âncoras do item:', id, erro);
    return {};
  }
}

// Cada ajuste parte do SVG original, nunca de uma deformação anterior.
function atualizarRoupa(registro) {
  const { elemento, item } = registro;
  const svg = criarSvg(item.imagem);
  configurarSvg(svg);
  elemento.replaceChildren(svg);
  delete elemento.dataset.deformacao;
  if (!corpoAtual || !categoriaDeformavel(item.categoria)) return;
  const pares = associarPontos(item.pontos, corpoAtual.pontos);
  if (pares.length < 3) {
    elemento.dataset.deformacao = 'sem-ancoras-suficientes';
    return;
  }
  try {
    deformarRoupa(svg, corpoAtual.svg, pares);
    elemento.dataset.deformacao = 'tps';
  } catch (erro) {
    elemento.dataset.deformacao = 'incompativel';
    console.warn('Roupa exibida sem deformação:', item.id, erro.message);
  }
}

const container = document.getElementById("bonecaContainer");
container.style.position = "relative";

const camadaItens = document.createElement("div");

camadaItens.id = "camadaItens";
camadaItens.style.position = "absolute";
camadaItens.style.inset = "0";
camadaItens.style.width = "100%";
camadaItens.style.height = "100%";
camadaItens.style.pointerEvents = "none";

container.appendChild(camadaItens);

function configurarSvg(svg) {
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
}

function criarSvg(conteudo) {
  const documento = new DOMParser().parseFromString(
    conteudo,
    "image/svg+xml"
  );

  if (documento.querySelector("parsererror")) {
    throw new Error("SVG inválido.");
  }

  const svg = documento.documentElement;

  if (svg.localName !== "svg" ||
    svg.namespaceURI !== "http://www.w3.org/2000/svg") {
    throw new Error("O conteúdo não é um SVG.");
  }

  const primeiroPath = svg.querySelector("path");
  if (primeiroPath) primeiroPath.classList.add("line");

  return document.importNode(svg, true);
}

function trocarCorpo(item) {
  const novoCorpo = criarSvg(item.imagem);

  const paths = novoCorpo.querySelectorAll("path");

  if (paths.length >= 2) {
    paths[1].style.setProperty(
      "fill",
      "#DFDFDF",
      "important"
    );
  }

  novoCorpo.id = "svgBase";
  configurarSvg(novoCorpo);

  const anterior = container.querySelector("#svgBase");

  if (anterior) {
    anterior.replaceWith(novoCorpo);
  } else {
    container.insertBefore(novoCorpo, camadaItens);
  }

  corpoAtual = { svg: novoCorpo, pontos: item.pontos || {} };
  for (const registro of roupasSelecionadas.values()) atualizarRoupa(registro);

  boneca.Corpo = {
    [item.subcategoria]: item.id
  };

  console.log("Boneca atual:", boneca);
}

async function carregarCorpoPadrao() {
  if (!corpoPadrao || !Number.isInteger(Number(corpoPadrao.id))) {
    console.warn("Nenhum corpo padrão definido no banco de dados.");
    return;
  }

  const versao = ++requisicaoCorpo;
  try {
    const [resposta, pontos] = await Promise.all([
      fetch(`/api/itens/${corpoPadrao.id}/svg`),
      carregarPontosSeguro(corpoPadrao.id)
    ]);
    if (!resposta.ok) throw new Error("Não foi possível carregar o corpo padrão.");
    const imagem = await resposta.text();
    // Não substitui um corpo escolhido durante o carregamento.
    if (versao !== requisicaoCorpo) return;
    trocarCorpo({ id: corpoPadrao.id, subcategoria: corpoPadrao.subcategoria, imagem, pontos });
  } catch (erro) {
    console.error("Erro ao carregar corpo padrão:", erro);
  }
}

carregarCorpoPadrao();

function selecionarItem(item) {
  const { id, categoria, subcategoria, imagem, z_index } = item;

  if (categoria === "Corpo") {
    trocarCorpo(item);
    return;
  }

  if (!boneca[categoria]) {
    boneca[categoria] = {};
  }

  if (boneca[categoria][subcategoria] === id) {
    removerItem(categoria, subcategoria);
    return;
  }

  const svg = criarSvg(imagem);
  configurarSvg(svg);

  const novoItem = document.createElement("div");

  novoItem.dataset.categoria = categoria;
  novoItem.dataset.subcategoria = subcategoria;
  novoItem.style.position = "absolute";
  novoItem.style.inset = "0";
  novoItem.style.width = "100%";
  novoItem.style.height = "100%";
  novoItem.style.zIndex = Number(z_index) || 0;

  novoItem.appendChild(svg);

  const itemAnterior = [...camadaItens.children].find(
    elemento =>
      elemento.dataset.categoria === categoria &&
      elemento.dataset.subcategoria === subcategoria
  );

  if (itemAnterior) {
    itemAnterior.replaceWith(novoItem);
  } else {
    camadaItens.appendChild(novoItem);
  }

  const chave = chaveItem(categoria, subcategoria);
  if (categoriaDeformavel(categoria)) {
    const registro = { elemento: novoItem, item };
    roupasSelecionadas.set(chave, registro);
    atualizarRoupa(registro);
  }

  boneca[categoria][subcategoria] = id;

  console.log("Boneca atual:", boneca);
}

function removerItem(categoria, subcategoria) {
  roupasSelecionadas.delete(chaveItem(categoria, subcategoria));
  const item = [...camadaItens.children].find(
    elemento =>
      elemento.dataset.categoria === categoria &&
      elemento.dataset.subcategoria === subcategoria
  );

  if (item) {
    item.remove();
  }

  if (boneca[categoria]) {
    delete boneca[categoria][subcategoria];

    if (Object.keys(boneca[categoria]).length === 0) {
      delete boneca[categoria];
    }
  }

  console.log("Boneca atual:", boneca);
}

document.querySelectorAll(".item-card").forEach(card => {
  card.addEventListener("click", async evento => {
    if (evento.target.closest(
      ".btn-deletar-item, .btn-editar-item"
    )) {
      return;
    }
    try {
      const id = Number(card.dataset.id);

      const categoria = card.dataset.categoria;
      const chave = chaveItem(categoria, card.dataset.subcategoria);
      const versao = categoria === "Corpo" ? ++requisicaoCorpo : (requisicoesItens.get(chave) || 0) + 1;
      requisicoesItens.set(chave, versao);
      const [resposta, pontos] = await Promise.all([
        fetch(`/api/itens/${id}/svg`),
        categoria === 'Corpo' || categoriaDeformavel(categoria) ? carregarPontosSeguro(id) : Promise.resolve({})
      ]);

      if (!resposta.ok) {
        throw new Error("Não foi possível carregar o SVG.");
      }
      const imagem = await resposta.text();
      if (categoria === "Corpo" ? versao !== requisicaoCorpo : requisicoesItens.get(chave) !== versao) return;

      selecionarItem({
        id,
        categoria: card.dataset.categoria,
        subcategoria: card.dataset.subcategoria,
        imagem,
        pontos,
        z_index: Number(card.dataset.zindex)
      });
    } catch (erro) {
      console.error("Erro ao selecionar item:", erro);
    }
  });
});

// Resumo do rodapé: soma os preços dos itens efetivamente selecionados.
const valorTotalRodape = document.getElementById("valorTotal");
const finalizarPersonalizacao = document.getElementById("finalizarPersonalizacao");
const precosItens = new Map(
  [...document.querySelectorAll(".item-card")].map(card => [
    String(card.dataset.id),
    Number(card.dataset.preco) || 0
  ])
);

function atualizarTotalArmario() {
  const ids = Object.values(boneca).flatMap(subcategorias => Object.values(subcategorias));
  const total = ids.reduce((soma, id) => soma + (precosItens.get(String(id)) || 0), 0);

  if (valorTotalRodape) {
    valorTotalRodape.textContent = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }
}

// Mantém o preço sincronizado também com o corpo padrão carregado assincronamente.
const observadorTotal = new MutationObserver(atualizarTotalArmario);
observadorTotal.observe(container, { childList: true, subtree: true });

if (finalizarPersonalizacao) {
  finalizarPersonalizacao.addEventListener("click", async () => {
    const itens = [...new Set(
      Object.values(boneca).flatMap(subcategorias => Object.values(subcategorias))
    )];

    if (!itens.length) {
      alert("Selecione pelo menos um item.");
      return;
    }

    finalizarPersonalizacao.disabled = true;

    try {
      const resposta = await fetch("/checkout/preparar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || ""
        },
        body: JSON.stringify({ itens })
      });

      if (resposta.redirected) {
        window.location.href = resposta.url;
        return;
      }

      const tipoResposta = resposta.headers.get("content-type") || "";

      if (!tipoResposta.includes("application/json")) {
        if (resposta.status === 403) {
          throw new Error("Sua sessão expirou. Atualize a página e tente novamente.");
        }

        throw new Error("O servidor não retornou uma resposta válida para o checkout. Verifique as rotas e tente novamente.");
      }

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao preparar compra.");
      }
      window.location.href = resultado.destino;
    } catch (erro) {
      alert(erro.message);
      finalizarPersonalizacao.disabled = false;
    }
  });
}

atualizarTotalArmario();
