import db from '../config/database.js';

const ItemModel = {
    async buscarCategoriasESubcategorias() {
        const { rows } = await db.query(`SELECT c.id AS categoria_id, c.nome AS categoria_nome,
            s.id AS subcategoria_id, s.nome AS subcategoria_nome
            FROM categoria c LEFT JOIN subcategoria s ON s.categoria_id = c.id
            ORDER BY c.id, s.id`);
        return rows;
    },
    async buscarTodosItens() {
        const { rows } = await db.query(`SELECT i.id, i.nome, i.descricao, i.preco,
            i.miniatura, i.z_index, i.subcategoria_id, s.nome AS subcategoria_nome,
            c.id AS categoria_id, c.nome AS categoria_nome
            FROM itens i JOIN subcategoria s ON s.id = i.subcategoria_id
            JOIN categoria c ON c.id = s.categoria_id ORDER BY i.id DESC`);
        return rows;
    },
    async buscarCorpoPadrao() {
        const { rows } = await db.query(`
            SELECT i.id, s.nome AS subcategoria
            FROM itens i
            JOIN subcategoria s ON s.id = i.subcategoria_id
            JOIN categoria c ON c.id = s.categoria_id
            WHERE c.nome = 'Corpo' AND i.padrao = TRUE
            LIMIT 1
        `);
        return rows[0] || null;
    },
    async buscarItemPorId(id) {
        const { rows } = await db.query('SELECT * FROM itens WHERE id = $1', [id]);
        return rows[0] || null;
    },
    async criarItem({ nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id }) {
        const { rows } = await db.query(`INSERT INTO itens
            (nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id]);
        return rows[0];
    },
    async atualizarItem(id, { nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id }) {
        const { rows } = await db.query(`UPDATE itens SET nome=$1, descricao=$2,
            preco=$3, imagem=COALESCE($4, imagem), miniatura=COALESCE($5, miniatura),
            z_index=$6, subcategoria_id=$7 WHERE id=$8 RETURNING *`,
            [nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id, id]);
        return rows[0] || null;
    },
    async deletarItem(id) {
        await db.query('DELETE FROM itens WHERE id=$1', [id]);
    }
};
export default ItemModel;
