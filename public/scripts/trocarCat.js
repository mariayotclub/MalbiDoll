let catAtual= null;

function trocarCat(botaoClick){
    catAtual=botaoClick.id;

    document.querySelectorAll('[id^="cat"]').forEach(cat=> {
        cat.style.display= "none";
    });

    document.getElementById("cat" + catAtual).style.display= "block";
}
    trocarCat(document.getElementById("Corpo"));