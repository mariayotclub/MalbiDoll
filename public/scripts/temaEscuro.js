(() => {
    const chave = 'malbidoll-tema';

    function aplicar(tema) {
        const escuro = tema === 'escuro';
        document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
        document.documentElement.style.colorScheme = escuro ? 'dark' : 'light';

        const botao = document.getElementById('alternarTema');
        if (!botao) return;

        const rotulo = escuro ? 'Ativar modo claro' : 'Ativar modo escuro';
        botao.setAttribute('aria-label', rotulo);
        botao.setAttribute('title', rotulo);
        botao.setAttribute('aria-pressed', String(escuro));

        if (botao.classList.contains('contas-alternar-tema')) {
            botao.querySelector('.tema-icone').textContent = escuro ? '☀' : '☾';
        } else {
            botao.innerHTML = escuro ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
            window.lucide?.createIcons();
        }
    }

    let salvo = 'claro';
    try { salvo = localStorage.getItem(chave) || 'claro'; } catch (_) { /* Armazenamento indisponível. */ }
    aplicar(salvo);

    document.addEventListener('DOMContentLoaded', () => {
        aplicar(document.documentElement.dataset.tema);
        document.getElementById('alternarTema')?.addEventListener('click', () => {
            const proximo = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
            try { localStorage.setItem(chave, proximo); } catch (_) { /* Sem persistência. */ }
            aplicar(proximo);
        });
    });
})();
