const boneca = {};

const container = document.getElementById("bonecaContainer");

container.style.position = "relative";

fetch("/assets/CMF.svg")
    .then(resultado => {
        if (!resultado.ok) {
            throw new Error("Não foi possível carregar a boneca base.");
        }

        return resultado.text();
    })
    .then(svg => {
        container.innerHTML = svg;

        const svgBase = container.querySelector("svg");

        if (!svgBase) {
            throw new Error("O arquivo CMF.svg não contém um SVG válido.");
        }

        svgBase.style.position = "absolute";
        svgBase.style.inset = "0";
        svgBase.style.width = "100%";
        svgBase.style.height = "100%";

        const camadaItens = document.createElement("div");

        camadaItens.id = "camadaItens";
        camadaItens.style.position = "absolute";
        camadaItens.style.inset = "0";
        camadaItens.style.pointerEvents = "none";

        container.appendChild(camadaItens);
    })
    .catch(erro => {
        console.error("Erro ao carregar a boneca:", erro);
    });
