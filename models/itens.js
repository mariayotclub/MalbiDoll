async function buscarTodos() {
    const resultado = await pool.query(
        `SELECT
            itens.id,
            itens.nome,
            itens.descricao,
            itens.preco,
            itens.imagem,
            subcategorias.id AS subcategoria_id,
            subcategorias.nome AS subcategoria,
            categorias.id AS categoria_id,
            categorias.nome AS categoria

         FROM itens

         JOIN subcategorias
            ON itens.subcategoria_id = subcategorias.id

         JOIN categorias
            ON subcategorias.categoria_id = categorias.id

         ORDER BY categorias.id, subcategorias.id, itens.id`
    );

    return resultado.rows;
}