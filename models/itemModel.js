import db from '../config/database.js';

const ItemModel = {
 
  async buscarCategoriasESubcategorias() {
    const query = `
      SELECT 
        c.id AS categoria_id,
        c.nome AS categoria_nome,
        s.id AS subcategoria_id,
        s.nome AS subcategoria_nome
      FROM categoria c
      LEFT JOIN subcategoria s ON c.id = s.categoria_id
      ORDER BY c.id, s.id;
    `;
    const { rows } = await db.query(query);
    return rows;
  },

  async buscarTodosItens() {
    const query = `
      SELECT 
        i.id,
        i.nome,
        i.descricao,
        i.preco,
        i.imagem,
        i.z_index,
        s.id AS subcategoria_id,
        s.nome AS subcategoria_nome,
        c.id AS categoria_id,
        c.nome AS categoria_nome
      FROM itens i
      INNER JOIN subcategoria s ON i.subcategoria_id = s.id
      INNER JOIN categoria c ON s.categoria_id = c.id
      ORDER BY i.id DESC;
    `;
    const { rows } = await db.query(query);
    return rows;
  },

  async criarItem(dadosItem) {
    const { nome, descricao, preco, imagem, z_index, subcategoria_id } = dadosItem;
    const query = `
      INSERT INTO itens (nome, descricao, preco, imagem, z_index, subcategoria_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      nome || '',
      descricao || null,
      preco ? parseFloat(preco) : 0.00,
      imagem || '',
      z_index ? parseInt(z_index, 10) : 1,
      subcategoria_id ? parseInt(subcategoria_id, 10) : null
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async deletarItem(id) {
    const query = 'DELETE FROM itens WHERE id = $1;';
    await db.query(query, [id]);
  }
};

export default ItemModel;