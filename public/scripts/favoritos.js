document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-favorito-id]').forEach(botao => {
        const id = botao.dataset.favoritoId;
        botao.addEventListener('click', async () => {
            if (botao.dataset.autenticado !== 'true') {
                window.location.href = `/login?retorno=${encodeURIComponent(window.location.pathname)}`;
                return;
            }

            botao.disabled = true;
            try {
                const resposta = await fetch(`/api/favoritos/${encodeURIComponent(id)}`, {
                    method: 'POST',
                    headers: { 'x-csrf-token': botao.dataset.csrf }
                });
                if (!resposta.ok) throw new Error('Não foi possível atualizar os favoritos.');
                const { favoritado } = await resposta.json();
                botao.dataset.favoritado = String(favoritado);
                botao.setAttribute('aria-pressed', String(favoritado));
                botao.setAttribute('aria-label', favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
                botao.title = botao.getAttribute('aria-label');
            } catch (erro) {
                alert(erro.message);
            } finally {
                botao.disabled = false;
            }
        });
    });
});
