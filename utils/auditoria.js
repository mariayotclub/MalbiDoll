import pool from '../config/database.js';

// Um erro no histórico não deve desfazer a operação principal já concluída.
export async function registrarAuditoria(administradorId, acao, entidade, entidadeId, descricao) {
  try {
    await pool.query(
      `INSERT INTO auditoria_admin
        (administrador_id, acao, entidade, entidade_id, descricao)
       VALUES ($1, $2, $3, $4, $5)`,
      [administradorId, acao, entidade, entidadeId, descricao.slice(0, 250)]
    );
  } catch (erro) {
    console.error('Não foi possível registrar a atividade administrativa:', erro);
  }
}
