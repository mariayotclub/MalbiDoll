document.addEventListener('DOMContentLoaded', () => {
    // Recupera a variável global de categorias injetada pelo EJS no HTML
    const categoriasData = window.categoriasData || [];

    // ==========================================
    // ELEMENTOS DO MODAL DE CADASTRO
    // ==========================================
    const modal = document.getElementById('modalItem');
    const btnFecharModal = document.getElementById('btnFecharModal');
    const categoriaSelect = document.getElementById('categoria_select');
    const subcategoriaSelect = document.getElementById('subcategoria_id');

    // ==========================================
    // ELEMENTOS DO MODAL DE EDIÇÃO
    // ==========================================
    const modalEditar = document.getElementById("modalEditarItem");
    const btnFecharModalEditar = document.getElementById("btnFecharModalEditar");
    const formEditar = document.getElementById("formEditarItem");
    
    const editCategoriaSelect = document.getElementById("edit_categoria_select");
    const editSubcategoriaSelect = document.getElementById("edit_subcategoria_id");
    const editInputNome = document.getElementById("edit_nome");
    const editInputDescricao = document.getElementById("edit_descricao");
    const editInputPreco = document.getElementById("edit_preco");
    const editInputZIndex = document.getElementById("edit_z_index");

    // ==========================================
    // FUNÇÃO GENÉRICA PARA PREENCHER SUBCATEGORIAS
    // ==========================================
    // Agora recebe qual "select" vai ser atualizado (o de cadastro ou o de edição)
    function atualizarSubcategorias(categoriaId, selectElement, subcategoriaSelecionadaId = null) {
        if (!selectElement) return;
        
        selectElement.innerHTML = '<option value="">Selecione uma Subcategoria</option>';

        const categoriaEncontrada = categoriasData.find(c => c.id == categoriaId);
        if (categoriaEncontrada && categoriaEncontrada.subcategorias) {
            categoriaEncontrada.subcategorias.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = sub.nome;
                if (subcategoriaSelecionadaId && sub.id == subcategoriaSelecionadaId) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        }
    }

    // ==========================================
    // LÓGICA DO MODAL DE CADASTRO
    // ==========================================
    if (categoriaSelect) {
        categoriaSelect.addEventListener('change', (e) => {
            atualizarSubcategorias(e.target.value, subcategoriaSelect);
        });
    }

    // Abrir Modal de Cadastro
    document.querySelectorAll('.btn-abrir-modal').forEach(button => {
        button.addEventListener('click', () => {
            const catId = button.getAttribute('data-categoria-id');
            const subId = button.getAttribute('data-subcategoria-id');

            if (catId && catId !== 'null') {
                categoriaSelect.value = catId;
                atualizarSubcategorias(catId, subcategoriaSelect, subId);
            } else {
                categoriaSelect.value = '';
                if (subcategoriaSelect) {
                    subcategoriaSelect.innerHTML = '<option value="">Selecione primeiro uma Categoria</option>';
                }
            }

            if (modal) modal.style.display = 'flex';
        });
    });

    if (btnFecharModal) {
        btnFecharModal.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }

    // ==========================================
    // LÓGICA DO MODAL DE EDIÇÃO
    // ==========================================
    if (editCategoriaSelect) {
        editCategoriaSelect.addEventListener("change", (e) => {
            atualizarSubcategorias(e.target.value, editSubcategoriaSelect);
        });
    }

    // Abrir Modal de Edição e preencher dados
    document.querySelectorAll('.btn-abrir-modal-editar').forEach(botao => {
        botao.addEventListener("click", function() {
            // Busca os dados nos atributos data-* do botão clicado
            const id = this.getAttribute("data-id");
            const nome = this.getAttribute("data-nome");
            const preco = this.getAttribute("data-preco");
            const descricao = this.getAttribute("data-descricao");
            const zindex = this.getAttribute("data-zindex");
            const catId = this.getAttribute("data-cat");
            const subcatId = this.getAttribute("data-subcat");

            // Define a rota do formulário com o ID dinâmico
            if (formEditar) {
                formEditar.action = `/armario/item/editar/${id}`;
            }

            // Preenche os campos de texto
            if (editInputNome) editInputNome.value = nome;
            if (editInputPreco) editInputPreco.value = preco;
            if (editInputDescricao) editInputDescricao.value = descricao;
            if (editInputZIndex) editInputZIndex.value = zindex;

            // Define a categoria e carrega as subcategorias corretas
            if (editCategoriaSelect && catId) {
                editCategoriaSelect.value = catId;
                atualizarSubcategorias(catId, editSubcategoriaSelect, subcatId);
            }

            // Exibe o modal de edição
            if (modalEditar) modalEditar.style.display = "flex";
        });
    });

    if (btnFecharModalEditar) {
        btnFecharModalEditar.addEventListener("click", () => {
            if (modalEditar) modalEditar.style.display = "none";
        });
    }

    // ==========================================
    // FECHAR MODAIS AO CLICAR NO FUNDO ESCURO
    // ==========================================
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
        if (e.target === modalEditar) {
            modalEditar.style.display = 'none';
        }
    });
});