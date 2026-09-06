const pool = require("../config/database");

async function criar(nome, categoriaId) {
    const resultado = await pool.query(
        `INSERT INTO subcategorias (nome, categoria_id)
         VALUES ($1, $2)
         RETURNING *`,
        [nome, categoriaId]
    );

    return resultado.rows[0];
}

async function buscarTodos() {
    const resultado = await pool.query(
        `SELECT * FROM subcategorias
         ORDER BY id`
    );

    return resultado.rows;
}

async function buscarPorId(id) {
    const resultado = await pool.query(
        `SELECT * FROM subcategorias
         WHERE id = $1`,
        [id]
    );

    return resultado.rows[0];
}

async function buscarPorCategoria(categoriaId) {
    const resultado = await pool.query(
        `SELECT * FROM subcategorias
         WHERE categoria_id = $1
         ORDER BY id`,
        [categoriaId]
    );

    return resultado.rows;
}

async function atualizar(id, nome, categoriaId) {
    const resultado = await pool.query(
        `UPDATE subcategorias
         SET nome = $1,
             categoria_id = $2
         WHERE id = $3
         RETURNING *`,
        [nome, categoriaId, id]
    );

    return resultado.rows[0];
}

async function deletar(id) {
    const resultado = await pool.query(
        `DELETE FROM subcategorias
         WHERE id = $1
         RETURNING *`,
        [id]
    );

    return resultado.rows[0];
}

module.exports = {
    criar,
    buscarTodos,
    buscarPorId,
    buscarPorCategoria,
    atualizar,
    deletar
};