(() => {
    const painel = document.getElementById("perfilPainel");
    const fundo = document.getElementById("perfilFundo");
    const botoes = document.querySelectorAll("[data-abrir-perfil]");
    const fecharBotao = document.getElementById("fecharPerfil");

    if (!painel || !fundo || !fecharBotao) return;

    let focoAnterior = null;
    const sombraEdicao = document.getElementById("perfilEdicaoSombra");
    const edicoes = [...painel.querySelectorAll("details.perfil-edicao")];

    function fecharEdicoes() {
        edicoes.forEach(edicao => { edicao.open = false; });
        if (sombraEdicao) sombraEdicao.hidden = true;
    }

    edicoes.forEach(edicao => {
        edicao.addEventListener("toggle", () => {
            if (edicao.open) {
                edicoes.forEach(outra => {
                    if (outra !== edicao) outra.open = false;
                });
            }
            if (sombraEdicao) {
                sombraEdicao.hidden = !edicoes.some(item => item.open);
            }
        });
    });

    sombraEdicao?.addEventListener("click", fecharEdicoes);

    function fechar() {
        fecharEdicoes();
        painel.classList.remove("aberto");
        painel.setAttribute("aria-hidden", "true");
        botoes.forEach(botao => botao.setAttribute("aria-expanded", "false"));
        fundo.hidden = true;
        document.body.classList.remove("perfil-aberto");

        if (focoAnterior?.isConnected) focoAnterior.focus();
    }

    function abrir() {
        const carrinho = document.getElementById("carrinhoPainel");

        if (carrinho?.classList.contains("aberto")) {
            document.getElementById("fecharCarrinho")?.click();
        }

        focoAnterior = document.activeElement;
        painel.classList.add("aberto");
        painel.setAttribute("aria-hidden", "false");
        botoes.forEach(botao => botao.setAttribute("aria-expanded", "true"));
        fundo.hidden = false;
        document.body.classList.add("perfil-aberto");
        fecharBotao.focus();
    }

    botoes.forEach(botao => {
        botao.addEventListener("click", evento => {
            evento.preventDefault();
            painel.classList.contains("aberto") ? fechar() : abrir();
        });
    });

    fecharBotao.addEventListener("click", fechar);
    fundo.addEventListener("click", fechar);

    document.addEventListener("keydown", evento => {
        if (!painel.classList.contains("aberto")) return;

        if (evento.key === "Escape") {
            if (edicoes.some(edicao => edicao.open)) {
                fecharEdicoes();
                return;
            }
            fechar();
            return;
        }

        if (evento.key !== "Tab") return;

        const elementos = [...painel.querySelectorAll(
            "a[href], button:not([disabled]), input:not([disabled])"
        )].filter(elemento => elemento.getClientRects().length > 0);

        if (!elementos.length) return;

        const primeiro = elementos[0];
        const ultimo = elementos[elementos.length - 1];

        if (evento.shiftKey && document.activeElement === primeiro) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primeiro.focus();
        }
    });

    if (new URLSearchParams(window.location.search).get("perfil") === "abrir") {
        abrir();
    }
})();
