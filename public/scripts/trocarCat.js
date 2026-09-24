let catAtual = null;
let subcatAtual = null;

function trocarCat(botaoClick){
    catAtual = botaoClick.id;

    document.querySelectorAll('[id^="cat"]').forEach(cat => {
        cat.style.display = "none";
    });

    const categoria = document.getElementById("cat" + catAtual);

    categoria.style.display = "block";

    const primeiroBotao = categoria.querySelector("button");

    if (primeiroBotao) {
        trocarsubCat(primeiroBotao);
    }
}

function trocarsubCat(botaoClick) {
    subcatAtual = botaoClick.id;

    document.querySelectorAll('[class^="displayItens"]').forEach(cat => {
        cat.style.display = "none";
    });

    document.getElementById("cat" + subcatAtual).style.display = "block";
}

trocarCat(document.getElementById("Corpo"));