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
            i.miniatura, i.z_index, i.cores, i.subcategoria_id, s.nome AS subcategoria_nome,
            c.id AS categoria_id, c.nome AS categoria_nome
            FROM itens i JOIN subcategoria s ON s.id = i.subcategoria_id
            JOIN categoria c ON c.id = s.categoria_id ORDER BY i.id DESC`);
        return rows;
    },
    async buscarTamanhosCorpo() {
        const { rows } = await db.query('SELECT id, nome FROM tamanhos_corpo ORDER BY ordem, id');
        return rows;
    },
    async listarCorposComAncoras() {
        const { rows } = await db.query(`
            SELECT i.id, i.nome, s.nome AS subcategoria,
                   i.tamanho_corpo_id, t.nome AS tamanho, i.pontos_referencia
            FROM itens i
            JOIN subcategoria s ON s.id = i.subcategoria_id
            JOIN categoria c ON c.id = s.categoria_id
            LEFT JOIN tamanhos_corpo t ON t.id = i.tamanho_corpo_id
            WHERE c.nome = 'Corpo'
            ORDER BY s.nome, t.ordem, i.id
        `);
        return rows;
    },
    async validarTamanhoCorpo(subcategoriaId, tamanhoId) {
        const { rows } = await db.query(`
            SELECT c.nome AS categoria FROM subcategoria s
            JOIN categoria c ON c.id = s.categoria_id WHERE s.id = $1
        `, [subcategoriaId]);
        if (!rows.length) throw new Error('Subcategoria inválida.');
        if (rows[0].categoria !== 'Corpo') return null;
        if (!Number.isSafeInteger(tamanhoId) || tamanhoId <= 0) {
            throw new Error('Selecione o tamanho do corpo.');
        }
        const tamanho = await db.query('SELECT id FROM tamanhos_corpo WHERE id = $1', [tamanhoId]);
        if (!tamanho.rows.length) throw new Error('Tamanho de corpo inválido.');
        return tamanhoId;
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
    async criarItem({ nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id, pontos_referencia, cores, tamanho_corpo_id = null }) {
        const { rows } = await db.query(`INSERT INTO itens
            (nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id, pontos_referencia, cores, tamanho_corpo_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id, JSON.stringify(pontos_referencia), JSON.stringify(cores), tamanho_corpo_id]);
        return rows[0];
    },
    async atualizarItem(id, { nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id, pontos_referencia, cores, tamanho_corpo_id = null }) {
        const { rows } = await db.query(`UPDATE itens SET nome=$1, descricao=$2,
            preco=$3, imagem=COALESCE($4, imagem), miniatura=COALESCE($5, miniatura),
            z_index=$6, subcategoria_id=$7, pontos_referencia=$9, cores=$10, tamanho_corpo_id=$11 WHERE id=$8 RETURNING *`,
            [nome, descricao, preco, imagem, miniatura, z_index, subcategoria_id, id, JSON.stringify(pontos_referencia), JSON.stringify(cores), tamanho_corpo_id]);
        return rows[0] || null;
    },
    async deletarItem(id) {
        await db.query('DELETE FROM itens WHERE id=$1', [id]);
    }
};
export default ItemModel;
