const categoriaSelect = document.getElementById("categoriaSelect");
const subcategoriaSelect = document.getElementById("subcategoriaSelect");

categoriaSelect.addEventListener("change", () => {
    const categoriaId = Number(categoriaSelect.value);

    subcategoriaSelect.innerHTML = `
        <option value="">
            Selecione uma subcategoria
        </option>
    `;

    if (!categoriaId) {
        subcategoriaSelect.disabled = true;
        return;
    }

    const subcategoriasFiltradas = subcategorias.filter(
        subcategoria => subcategoria.categoria_id === categoriaId
    );

    subcategoriasFiltradas.forEach(subcategoria => {
        const option = document.createElement("option");

        option.value = subcategoria.id;
        option.textContent = subcategoria.nome;

        subcategoriaSelect.appendChild(option);
    });

    subcategoriaSelect.disabled = false;
});