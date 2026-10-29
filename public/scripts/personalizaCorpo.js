// O corpo só entra no pedido depois que seu SVG for carregado com sucesso.
const boneca = {};
const corpoPadrao = window.corpoPadrao;
let requisicaoCorpo = 0;

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
        const resposta = await fetch(`/api/itens/${corpoPadrao.id}/svg`);
        if (!resposta.ok) throw new Error("Não foi possível carregar o corpo padrão.");
        const imagem = await resposta.text();
        // Não substitui um corpo escolhido durante o carregamento.
        if (versao !== requisicaoCorpo) return;
        trocarCorpo({ id: corpoPadrao.id, subcategoria: corpoPadrao.subcategoria, imagem });
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

    boneca[categoria][subcategoria] = id;

    console.log("Boneca atual:", boneca);
}

function removerItem(categoria, subcategoria) {
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
            const versao = categoria === "Corpo" ? ++requisicaoCorpo : null;
            const resposta = await fetch(`/api/itens/${id}/svg`);
            
            if (!resposta.ok) {
                throw new Error("Não foi possível carregar o SVG.");
            }
            const imagem = await resposta.text();
            if (categoria === "Corpo" && versao !== requisicaoCorpo) return;

            selecionarItem({
                id,
                categoria: card.dataset.categoria,
                subcategoria: card.dataset.subcategoria,
                imagem,
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
    finalizarPersonalizacao.addEventListener("click", () => {
        // Guarda a composição para integração posterior com o checkout.
        localStorage.setItem("malbidoll_personalizacao_pendente", JSON.stringify({
            itens: boneca,
            atualizadoEm: new Date().toISOString()
        }));
        alert("Sua personalização foi salva neste navegador. A finalização do pedido ainda precisa ser integrada ao checkout.");
    });
}

atualizarTotalArmario();
