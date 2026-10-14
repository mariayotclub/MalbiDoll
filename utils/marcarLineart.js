import { JSDOM } from "jsdom";

export function marcarLineart(svg) {
    if (typeof svg !== "string" || !svg.trim()) {
        throw new Error("SVG inválido.");
    }

    const janela = new JSDOM("").window;
    const parser = new janela.DOMParser();

    const documento = parser.parseFromString(
        svg,
        "image/svg+xml"
    );

    if (documento.querySelector("parsererror")) {
        throw new Error("SVG malformado.");
    }

    const paths = documento.querySelectorAll("path");

    if (paths.length > 0) {
        paths[0].classList.add("line");
    }

    return new janela.XMLSerializer().serializeToString(
        documento.documentElement
    );
}