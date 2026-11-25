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
    SELECT a.id, COALESCE(u.nome, a.nome) AS nome, a.estrelas, a.comentario,
       a.foto IS NOT NULL AS tem_foto, a.criado_em, a.usuario_id, a.resposta_admin, a.resposta_em,
       (u.foto IS NOT NULL) AS tem_avatar
    FROM avaliacoes_np a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.boneca_id = $1
    ORDER BY a.criado_em DESC
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

  async avaliar({ id, nome, usuarioId, estrelas, comentario, foto }) {
    await pool.query(`
    INSERT INTO avaliacoes_np (boneca_id, nome, usuario_id, estrelas, comentario, foto)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [id, nome, usuarioId, estrelas, comentario, foto]);
  },

  async favoritos(usuarioId) {
    const { rows } = await pool.query(`
    SELECT b.id, b.nome FROM favoritos_np f
    JOIN bonecas_np b ON b.id = f.boneca_id
    WHERE f.usuario_id = $1 AND b.ativo = TRUE
    ORDER BY f.criado_em DESC
  `, [usuarioId]);
    return rows;
  },

  async ehFavorito(usuarioId, bonecaId) {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM favoritos_np WHERE usuario_id = $1 AND boneca_id = $2',
      [usuarioId, bonecaId]
    );
    return rowCount > 0;
  },

  async alternarFavorito(usuarioId, bonecaId) {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query('SELECT pg_advisory_xact_lock($1, $2)', [usuarioId, bonecaId]);
      const removido = await cliente.query(
        'DELETE FROM favoritos_np WHERE usuario_id = $1 AND boneca_id = $2 RETURNING boneca_id',
        [usuarioId, bonecaId]
      );
      if (removido.rowCount) {
        await cliente.query('COMMIT');
        return false;
      }
      await cliente.query(
        'INSERT INTO favoritos_np (usuario_id, boneca_id) VALUES ($1, $2)',
        [usuarioId, bonecaId]
      );
      await cliente.query('COMMIT');
      return true;
    } catch (erro) {
      await cliente.query('ROLLBACK');
      throw erro;
    } finally {
      cliente.release();
    }
  },

  async criar({ nome, descricao, preco, imagem, ativo }) {
    const { rows } = await pool.query(`
    INSERT INTO bonecas_np (nome, descricao, preco, imagem, ativo)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [nome, descricao, preco, imagem, ativo]);
    return rows[0];
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