import pool from '../config/database.js';

const resumo = `
  SELECT b.id, b.nome, b.descricao, b.preco, b.ativo, b.criado_em,
         COUNT(a.id)::int AS total_avaliacoes,
         COALESCE(ROUND(AVG(a.estrelas)::numeric, 1), 0)::float AS media
  FROM bonecas_np b 
  LEFT JOIN avaliacoes_np a ON a.boneca_id = b.id
`;

const LojaModel = {
  async listar(apenasAtivas = true) {
    const { rows } = await pool.query(`
      ${resumo} 
      ${apenasAtivas ? 'WHERE b.ativo = TRUE' : ''} 
      GROUP BY b.id 
      ORDER BY b.criado_em DESC
    `);
    return rows;
  },

  async obter(id) {
    const { rows } = await pool.query(`
      ${resumo} 
      WHERE b.id = $1 
      GROUP BY b.id
    `, [id]);
    return rows[0];
  },

  async imagem(id) {
    const { rows } = await pool.query(`
      SELECT imagem 
      FROM bonecas_np 
      WHERE id = $1
    `, [id]);
    return rows[0]?.imagem;
  },

  async avaliacoes(id) {
    const { rows } = await pool.query(`
      SELECT id, nome, estrelas, comentario, foto IS NOT NULL AS tem_foto, criado_em 
      FROM avaliacoes_np 
      WHERE boneca_id = $1 
      ORDER BY criado_em DESC
    `, [id]);
    return rows;
  },

  async foto(id) {
    const { rows } = await pool.query(`
      SELECT foto 
      FROM avaliacoes_np 
      WHERE id = $1
    `, [id]);
    return rows[0]?.foto;
  },

  async avaliar({ id, nome, estrelas, comentario, foto }) {
    await pool.query(`
      INSERT INTO avaliacoes_np (boneca_id, nome, estrelas, comentario, foto) 
      VALUES ($1, $2, $3, $4, $5)
    `, [id, nome, estrelas, comentario, foto]);
  },

  async criar({ nome, descricao, preco, imagem, ativo }) {
    await pool.query(`
      INSERT INTO bonecas_np (nome, descricao, preco, imagem, ativo) 
      VALUES ($1, $2, $3, $4, $5)
    `, [nome, descricao, preco, imagem, ativo]);
  },

  async editar(id, { nome, descricao, preco, imagem, ativo }) {
    const { rowCount } = await pool.query(`
      UPDATE bonecas_np 
      SET nome = $1, descricao = $2, preco = $3, imagem = COALESCE($4, imagem), ativo = $5 
      WHERE id = $6
    `, [nome, descricao, preco, imagem, ativo, id]);
    return rowCount;
  },

  async excluir(id) {
    const { rowCount } = await pool.query(`
      DELETE FROM bonecas_np 
      WHERE id = $1
    `, [id]);
    return rowCount;
  },

  async itens() {
    const { rows } = await pool.query(`
      SELECT i.id, i.nome, i.descricao, i.preco, i.z_index, s.nome AS subcategoria, c.nome AS categoria 
      FROM itens i 
      JOIN subcategoria s ON s.id = i.subcategoria_id 
      JOIN categoria c ON c.id = s.categoria_id 
      ORDER BY i.id DESC
    `);
    return rows;
  }
};

export default LojaModel;