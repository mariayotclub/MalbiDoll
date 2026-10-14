
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const janela = new JSDOM("").window;
const purify = createDOMPurify(janela);

const SVG_NS = "http://www.w3.org/2000/svg";

const namespacesEditor = new Set([
    "http://www.inkscape.org/namespaces/inkscape",
    "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
]);

const propriedadesPermitidas = new Set([
    "fill",
    "stroke",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "fill-rule",
    "clip-rule",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-miterlimit"
]);

function converterEstilos(elemento) {
    const estilo = elemento.getAttribute("style");

    if (!estilo) return;

    for (const declaracao of estilo.split(";")) {
        const separador = declaracao.indexOf(":");

        if (separador === -1) continue;

        const nome = declaracao
            .slice(0, separador)
            .trim()
            .toLowerCase();

        const valor = declaracao
            .slice(separador + 1)
            .trim();

        if (!propriedadesPermitidas.has(nome)) continue;

        // Impede URLs, funções CSS e valores perigosos.
        if (
            !/^[#a-zA-Z0-9.,%\s+-]+$/.test(valor) ||
            /!important/i.test(valor)
        ) {
            continue;
        }

        elemento.setAttribute(nome, valor);
    }

    elemento.removeAttribute("style");
}

export function validarSvg(conteudo) {
    // 1. Verifica o conteúdo recebido.
    if (
        typeof conteudo !== "string" ||
        !conteudo.trim()
    ) {
        throw new Error("Arquivo SVG vazio.");
    }

    // 2. Limite de tamanho: 2 MB.
    if (
        Buffer.byteLength(conteudo, "utf8") >
        2 * 1024 * 1024
    ) {
        throw new Error("O SVG ultrapassa 2 MB.");
    }

    // 3. Interpreta o SVG como XML.
    const parser = new janela.DOMParser();

    const documento = parser.parseFromString(
        conteudo,
        "image/svg+xml"
    );

    const raiz = documento.documentElement;

    if (
        documento.querySelector("parsererror") ||
        !raiz ||
        raiz.localName !== "svg" ||
        raiz.namespaceURI !== SVG_NS
    ) {
        throw new Error("Arquivo SVG inválido.");
    }

    // 4. Remove elementos específicos do Inkscape.
    for (const elemento of [
        ...raiz.querySelectorAll("*")
    ]) {
        if (namespacesEditor.has(elemento.namespaceURI)) {
            elemento.remove();
        }
    }

    // 5. Remove atributos específicos do editor
    // e converte estilos CSS em atributos SVG.
    for (const elemento of [
        raiz,
        ...raiz.querySelectorAll("*")
    ]) {
        for (const atributo of [...elemento.attributes]) {
            if (namespacesEditor.has(atributo.namespaceURI)) {
                elemento.removeAttributeNode(atributo);
            }
        }

        converterEstilos(elemento);
    }

    raiz.removeAttribute("xmlns:inkscape");
    raiz.removeAttribute("xmlns:sodipodi");

    // 6. Sanitiza diretamente o elemento SVG.
    // IN_PLACE evita transformar o SVG em HTML.
    const svg = purify.sanitize(raiz, {
        IN_PLACE: true,

        USE_PROFILES: {
            svg: true,
            svgFilters: true
        },

        FORBID_TAGS: [
            "script",
            "foreignObject",
            "iframe",
            "object",
            "embed",
            "style",
            "animate",
            "animateMotion",
            "animateTransform",
            "set",
            "use"
        ],

        ADD_DATA_URI_TAGS: ["image"]
    });

    // 7. Confirma que a raiz foi preservada.
    if (
        !svg ||
        svg.localName !== "svg" ||
        svg.namespaceURI !== SVG_NS
    ) {
        throw new Error(
            "A sanitização não preservou o SVG."
        );
    }

    // 8. Faz uma verificação adicional dos atributos.
    for (const elemento of [
        svg,
        ...svg.querySelectorAll("*")
    ]) {
        for (const atributo of [...elemento.attributes]) {
            const nome = atributo.name.toLowerCase();
            const valor = atributo.value.trim();

            // Remove eventos e referências CSS perigosas.
            if (
                nome.startsWith("on") ||
                nome === "style" ||
                /url\s*\(/i.test(valor) ||
                /@import|expression\s*\(/i.test(valor)
            ) {
                elemento.removeAttributeNode(atributo);
                continue;
            }

            // Permite apenas referências internas ou
            // imagens PNG incorporadas.
            if (
                nome === "href" ||
                nome === "xlink:href"
            ) {
                const referenciaInterna =
                    /^#[\w.-]+$/.test(valor);

                const pngIncorporado =
                    elemento.localName === "image" &&
                    /^data:image\/png;base64,[a-z0-9+/=\s]+$/i.test(
                        valor
                    );

                if (
                    !referenciaInterna &&
                    !pngIncorporado
                ) {
                    elemento.removeAttributeNode(atributo);
                }
            }
        }
    }

    // 9. Verifica se há paths.
    if (!svg.querySelector("path")) {
        throw new Error(
            "O SVG não contém nenhum path."
        );
    }

    // 10. Serializa o SVG sanitizado.
    const resultado = new janela.XMLSerializer()
        .serializeToString(svg);

    // 11. Confere se o XML final continua válido.
    const verificacao = parser.parseFromString(
        resultado,
        "image/svg+xml"
    );

    if (
        verificacao.querySelector("parsererror") ||
        verificacao.documentElement.localName !== "svg" ||
        verificacao.documentElement.namespaceURI !== SVG_NS
    ) {
        throw new Error(
            "O SVG final não passou na validação."
        );
    }

    // 12. Retorna o SVG pronto para armazenamento.
    return resultado;
}
