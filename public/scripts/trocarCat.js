let catAtual = null;
let subcatAtual = null;

function trocarCat(botaoClick){
    if (!botaoClick) return;
    catAtual = botaoClick.id;

    // Esconde todas as categorias principais (Corpo, Rosto, etc.)
    document.querySelectorAll('.quadrado > div[id^="cat"]').forEach(cat => {
        cat.style.display = "none";
    });

    const categoria = document.getElementById("cat" + catAtual);
    if (categoria) {
        categoria.style.display = "block"; // A categoria principal continua "block"

        // Localiza e clica no primeiro botão da subcategoria automaticamente
        const primeiroBotao = categoria.querySelector('.linhaSubCat button');
        if (primeiroBotao) {
            trocarsubCat(primeiroBotao);
        }
    }
}

function trocarsubCat(botaoClick) {
    if (!botaoClick) return;
    subcatAtual = botaoClick.id;

    // Esconde todas as divs de exibição de itens (.displayItens)
    document.querySelectorAll('.displayItens').forEach(cat => {
        cat.style.display = "none";
    });

    // Exibe apenas a subcategoria selecionada (lado a lado / flex)
    const abaSubcategoria = document.getElementById("cat" + subcatAtual);
    if (abaSubcategoria) {
        abaSubcategoria.style.display = "flex"; 
    }

    // NOVA LÓGICA DO SUBTÍTULO: Ler o 'data-nome' do botão e atualizar na tela
    const nomeLegivel = botaoClick.getAttribute("data-nome") || subcatAtual;
    const containerCat = botaoClick.closest('div[id^="cat"]'); 
    
    if (containerCat) {
        const subtitulo = containerCat.querySelector(".subtitulo");
        if (subtitulo) {
            subtitulo.innerText = nomeLegivel;
        }
    }
}

// Inicializa a primeira aba (Corpo) assim que o script carrega
const btnCorpo = document.getElementById("Corpo");
if (btnCorpo) {
    trocarCat(btnCorpo);
}