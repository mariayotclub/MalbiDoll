fetch("/assets/CMF.svg")
    .then(resultado => resultado.text())
    .then(svg => {
        document.getElementById("bonecaContainer").innerHTML=svg;
    })