document.addEventListener('DOMContentLoaded', () => {
    // Recupera a variável global de categorias injetada pelo EJS no HTML
    const categoriasData = window.categoriasData || [];

    const modal = document.getElementById('modalItem');
    const btnFecharModal = document.getElementById('btnFecharModal');
    const categoriaSelect = document.getElementById('categoria_select');
    const subcategoriaSelect = document.getElementById('subcategoria_id');

    // Função para preencher e filtrar as subcategorias do select
    function atualizarSubcategorias(categoriaId, subcategoriaSelecionadaId = null) {
        subcategoriaSelect.innerHTML = '<option value="">Selecione uma Subcategoria</option>';

        const categoriaEncontrada = categoriasData.find(c => c.id == categoriaId);
        if (categoriaEncontrada && categoriaEncontrada.subcategorias) {
            categoriaEncontrada.subcategorias.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = sub.nome;
                if (subcategoriaSelecionadaId && sub.id == subcategoriaSelecionadaId) {
                    option.selected = true;
                }
                subcategoriaSelect.appendChild(option);
            });
        }
    }

    // Evento de mudança manual da categoria dentro do modal
    if (categoriaSelect) {
        categoriaSelect.addEventListener('change', (e) => {
            atualizarSubcategorias(e.target.value);
        });
    }

    // Abrir Modal ao clicar no botão de qualquer Div e auto-selecionar os selects
    document.querySelectorAll('.btn-abrir-modal').forEach(button => {
        button.addEventListener('click', () => {
            const catId = button.getAttribute('data-categoria-id');
            const subId = button.getAttribute('data-subcategoria-id');

            if (catId && catId !== 'null') {
                categoriaSelect.value = catId;
                atualizarSubcategorias(catId, subId);
            } else {
                categoriaSelect.value = '';
                subcategoriaSelect.innerHTML = '<option value="">Selecione primeiro uma Categoria</option>';
            }

            modal.style.display = 'flex';
        });
    });

    // Fechar Modal no X
    if (btnFecharModal) {
        btnFecharModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Fechar Modal ao clicar no fundo escuro
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});