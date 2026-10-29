(() => {
    const chave = 'malbidoll-favoritos';
    const ler = () => {
        try { return JSON.parse(localStorage.getItem(chave) || '[]'); } catch (_) { return []; }
    };
    const salvar = ids => localStorage.setItem(chave, JSON.stringify(ids));
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-favorito-id]').forEach(botao => {
            const id = String(botao.dataset.favoritoId);
            const atualizar = () => {
                const ativo = ler().includes(id);
                botao.setAttribute('aria-pressed', String(ativo));
                botao.textContent = ativo ? '♥ Remover dos favoritos' : '♡ Adicionar aos favoritos';
            };
            botao.addEventListener('click', () => {
                const ids = ler();
                salvar(ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
                atualizar();
            });
            atualizar();
        });
        const lista = document.getElementById('listaFavoritos');
        if (!lista) return;
        const ids = ler();
        if (!ids.length) { lista.textContent = 'Você ainda não adicionou bonecas aos favoritos.'; return; }
        ids.forEach(async id => {
            try {
                const resposta = await fetch(`/api/bonecas/${encodeURIComponent(id)}`);
                if (!resposta.ok) return;
                const boneca = await resposta.json();
                const item = document.createElement('p');
                const link = document.createElement('a');
                link.href = `/bonecas/${encodeURIComponent(id)}`;
                link.textContent = boneca.nome;
                item.append(link);
                lista.append(item);
            } catch (_) { /* Produto indisponível. */ }
        });
    });
})();
