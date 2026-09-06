const pool = require("../config/database");

async function criar(nome) {
    const resultado = await pool.query(
        `INSERT INTO categoria (nome)
         VALUES ($1)
         RETURNING *`,
        [nome]
    );

    return resultado.rows[0];
}

async function buscarTodos() {
    const resultado = await pool.query(
        `SELECT * FROM categoria
         ORDER BY id`
    );

    return resultado.rows;
}

async function buscarPorId(id) {
    const resultado = await pool.query(
        `SELECT * FROM categoria
         WHERE id = $1`,
        [id]
    );

    return resultado.rows[0];
}

async function atualizar(id, nome) {
    const resultado = await pool.query(
        `UPDATE categoria
         SET nome = $1
         WHERE id = $2
         RETURNING *`,
        [nome, id]
    );

    return resultado.rows[0];
}

async function deletar(id) {
    const resultado = await pool.query(
        `DELETE FROM categoria
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
    atualizar,
    deletar
};