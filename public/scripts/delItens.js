    let itemParaDeletarId = null;
    let cardParaDeletarElemento = null;
    const modalConfirmacao = document.getElementById('modalConfirmacao');
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
    const btnCancelarExclusao = document.getElementById('btnCancelarExclusao');

    // Ao clicar no 'X' de excluir em qualquer card
    document.querySelectorAll('.btn-deletar-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            itemParaDeletarId = btn.getAttribute('data-id');
            cardParaDeletarElemento = btn.closest('.item-card');

            if (!itemParaDeletarId || itemParaDeletarId === 'undefined') return;

            // Mostra o nosso próprio modal de confirmação
            modalConfirmacao.style.display = 'flex';
        });
    });

    // Se o usuário clicar em Cancelar no modal
    btnCancelarExclusao.addEventListener('click', () => {
        modalConfirmacao.style.display = 'none';
        itemParaDeletarId = null;
        cardParaDeletarElemento = null;
    });

    // Se o usuário confirmar a exclusão no modal
    btnConfirmarExclusao.addEventListener('click', async () => {
        if (!itemParaDeletarId) return;

        try {
            const response = await fetch(`/armario/item/${itemParaDeletarId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                if (cardParaDeletarElemento) {
                    cardParaDeletarElemento.remove();
                }
            } else {
                alert('Erro ao excluir o item no servidor.');
            }
        } catch (err) {
            console.error('Erro de conexão ao excluir:', err);
            alert('Erro de conexão ao tentar excluir.');
        } finally {
            // Fecha o modal e limpa as variáveis
            modalConfirmacao.style.display = 'none';
            itemParaDeletarId = null;
            cardParaDeletarElemento = null;
        }
    });
