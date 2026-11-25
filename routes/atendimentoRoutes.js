import { Router } from 'express';
import pool from '../config/database.js';
import { exigirLogin, exigirAdmin } from '../middlewares/acesso.js';
const router = Router();
const id = v => /^\d+$/.test(String(v)) && Number(v) > 0 ? String(v) : null;
const erro = (res, e) => { console.error('Atendimento:', e); res.status(500).json({ erro: 'Não foi possível concluir a operação.' }); };
const guard = async (req, res, next) => { try { const a = await pool.query('SELECT * FROM atendimentos WHERE id=$1 AND ($2::boolean OR usuario_id=$3)', [id(req.params.id) || 0, req.usuario.tipo === 'admin', req.usuario.id]); if (!a.rowCount) return res.sendStatus(404); req.atendimento = a.rows[0]; next(); } catch (e) { erro(res, e) } };
router.get('/api/atendimentos', exigirLogin, async (req, res) => { try { const r = await pool.query(`SELECT a.*,p.numero AS pedido_numero, (SELECT COUNT(*)::int FROM atendimento_mensagens m WHERE m.atendimento_id=a.id AND m.autor_id<>$1 AND m.lida_em IS NULL) AS nao_lidas FROM atendimentos a LEFT JOIN pedidos p ON p.id=a.pedido_id WHERE a.usuario_id=$1 ORDER BY a.atualizado_em DESC LIMIT 100`, [req.usuario.id]); res.json(r.rows) } catch (e) { erro(res, e) } });
// Os limites são aplicados em transação com bloqueio por usuário para evitar concorrência.
const LIMITE_DIARIO = 3;
const LIMITE_ATIVOS = 3;
const LIMITE_MENSAGENS = 5;

router.post('/api/atendimentos', exigirLogin, async (req, res) => {
  const assunto = String(req.body.assunto || '').trim().slice(0, 100);
  if (!assunto) return res.status(400).json({ erro: 'Informe o assunto.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM usuarios WHERE id=$1 FOR UPDATE', [req.usuario.id]);
    const excecao = await client.query(
      'SELECT sem_limites, bloqueado_ate FROM atendimento_excecoes WHERE usuario_id=$1',
      [req.usuario.id]
    );
    const config = excecao.rows[0] || {};
    if (config.bloqueado_ate && new Date(config.bloqueado_ate) > new Date()) {
      await client.query('ROLLBACK');
      return res.status(429).json({ erro: 'A abertura de atendimentos está temporariamente restrita.' });
    }
    if (!config.sem_limites) {
      const limites = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE criado_em >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')::int AS hoje,
          COUNT(*) FILTER (WHERE status <> 'resolvido')::int AS ativos
        FROM atendimentos WHERE usuario_id=$1
      `, [req.usuario.id]);
      if (limites.rows[0].hoje >= LIMITE_DIARIO || limites.rows[0].ativos >= LIMITE_ATIVOS) {
        await client.query('ROLLBACK');
        return res.status(429).json({ erro: limites.rows[0].hoje >= LIMITE_DIARIO
          ? 'Limite de 3 novos atendimentos por dia atingido.'
          : 'Você já possui 3 atendimentos ativos.' });
      }
    }
    let pedido = null;
    if (req.body.pedido_id) {
      const result = await client.query('SELECT id FROM pedidos WHERE id=$1 AND usuario_id=$2',
        [id(req.body.pedido_id) || 0, req.usuario.id]);
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Pedido inválido.' });
      }
      pedido = result.rows[0].id;
    }
    const criado = await client.query(
      'INSERT INTO atendimentos(usuario_id,assunto,pedido_id) VALUES($1,$2,$3) RETURNING *',
      [req.usuario.id, assunto, pedido]
    );
    await client.query('COMMIT');
    res.status(201).json(criado.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    erro(res, error);
  } finally {
    client.release();
  }
});

router.get('/api/atendimentos/pedidos', exigirLogin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, numero, criado_em FROM pedidos WHERE usuario_id=$1 ORDER BY criado_em DESC, id DESC',
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (error) { erro(res, error); }
});

router.post('/api/atendimentos/:id/pedido', exigirLogin, guard, async (req, res) => {
  try {
    if (req.usuario.tipo === 'admin') return res.sendStatus(403);
    let pedidoId = null;
    if (req.body.pedido_id) {
      const result = await pool.query(
        'SELECT id FROM pedidos WHERE id=$1 AND usuario_id=$2',
        [id(req.body.pedido_id) || 0, req.usuario.id]
      );
      if (!result.rowCount) return res.status(400).json({ erro: 'Pedido inválido.' });
      pedidoId = result.rows[0].id;
    }
    await pool.query('UPDATE atendimentos SET pedido_id=$1 WHERE id=$2', [pedidoId, req.atendimento.id]);
    res.json({ pedido_id: pedidoId });
  } catch (error) { erro(res, error); }
});

router.get('/api/atendimentos/:id', exigirLogin, guard, async (req, res) => { try { const r = await pool.query('SELECT id,autor_id,mensagem,criado_em FROM atendimento_mensagens WHERE atendimento_id=$1 ORDER BY id ASC LIMIT 500', [req.atendimento.id]); await pool.query('UPDATE atendimento_mensagens SET lida_em=now() WHERE atendimento_id=$1 AND autor_id<>$2 AND lida_em IS NULL', [req.atendimento.id, req.usuario.id]); res.json({ atendimento: req.atendimento, mensagens: r.rows }) } catch (e) { erro(res, e) } });
router.post('/api/atendimentos/:id/mensagens', exigirLogin, guard, async (req, res) => {
  const mensagem = String(req.body.mensagem || '').trim();
  if (!mensagem || mensagem.length > 3000) {
    return res.status(400).json({ erro: 'Mensagem deve ter de 1 a 3000 caracteres.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM atendimentos WHERE id=$1 FOR UPDATE', [req.atendimento.id]);
    if (req.usuario.tipo !== 'admin') {
      const excecao = await client.query(
        'SELECT sem_limites, bloqueado_ate FROM atendimento_excecoes WHERE usuario_id=$1',
        [req.usuario.id]
      );
      const config = excecao.rows[0] || {};
      if (config.bloqueado_ate && new Date(config.bloqueado_ate) > new Date()) {
        await client.query('ROLLBACK');
        return res.status(429).json({ erro: 'O envio de mensagens está temporariamente restrito.' });
      }
      if (!config.sem_limites) {
        const recentes = await client.query(`
          SELECT mensagem FROM atendimento_mensagens
          WHERE autor_id=$1 AND criado_em > now() - interval '10 seconds'
          ORDER BY id DESC LIMIT 5
        `, [req.usuario.id]);
        if (recentes.rowCount >= LIMITE_MENSAGENS) {
          await client.query('ROLLBACK');
          return res.status(429).json({ erro: 'Aguarde alguns segundos antes de enviar mais mensagens.' });
        }
        const ultima = await client.query(`
          SELECT mensagem FROM atendimento_mensagens
          WHERE atendimento_id=$1 AND autor_id=$2 ORDER BY id DESC LIMIT 1
        `, [req.atendimento.id, req.usuario.id]);
        if (ultima.rows[0]?.mensagem === mensagem) {
          await client.query('ROLLBACK');
          return res.status(409).json({ erro: 'Esta mensagem já foi enviada.' });
        }
      }
    }
    const inserida = await client.query(`
      INSERT INTO atendimento_mensagens(atendimento_id,autor_id,mensagem)
      VALUES($1,$2,$3) RETURNING id,autor_id,mensagem,criado_em
    `, [req.atendimento.id, req.usuario.id, mensagem]);
    await client.query('UPDATE atendimentos SET atualizado_em=now(), status=$2 WHERE id=$1',
      [req.atendimento.id, req.usuario.tipo === 'admin' ? 'aguardando_cliente' : 'aberto']);
    await client.query('COMMIT');
    res.status(201).json(inserida.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    erro(res, error);
  } finally {
    client.release();
  }
});

// Exceções são controladas exclusivamente por administradores.
router.post('/api/admin/atendimento/excecoes/:usuarioId', exigirLogin, exigirAdmin, async (req, res) => {
  const usuarioId = id(req.params.usuarioId);
  if (!usuarioId || typeof req.body.sem_limites !== 'boolean') return res.sendStatus(400);
  const dias = req.body.bloqueio_dias;
  if (!Number.isInteger(dias) || ![0, 1, 3, 5, 7].includes(dias)) {
    return res.status(400).json({ erro: 'Período de restrição inválido.' });
  }

  try {
    const resultado = await pool.query(`
      INSERT INTO atendimento_excecoes(usuario_id, sem_limites, bloqueado_ate)
      VALUES($1, $2, CASE WHEN $3::int = 0 THEN NULL ELSE now() + ($3::int * interval '1 day') END)
      ON CONFLICT(usuario_id)
      DO UPDATE SET
        sem_limites = EXCLUDED.sem_limites,
        bloqueado_ate = EXCLUDED.bloqueado_ate
      RETURNING *
    `, [usuarioId, req.body.sem_limites, dias]);
    res.json(resultado.rows[0]);
  } catch (error) {
    erro(res, error);
  }
});

router.post('/api/atendimentos/:id/status', exigirLogin, guard, async (req, res) => { try { const status = String(req.body.status || ''); const permitidos = req.usuario.tipo === 'admin' ? ['aberto', 'em_andamento', 'aguardando_cliente', 'resolvido'] : ['aberto']; if (!permitidos.includes(status)) return res.sendStatus(400); if (req.usuario.tipo !== 'admin' && status === 'aberto' && req.atendimento.status !== 'resolvido') return res.sendStatus(400); await pool.query('UPDATE atendimentos SET status=$1,atualizado_em=now() WHERE id=$2', [status, req.atendimento.id]); res.json({ status }) } catch (e) { erro(res, e) } });
router.get('/admin/atendimento', exigirLogin, exigirAdmin, async (req, res, next) => { try { let aba = req.query.aba === 'historico' ? 'historico' : 'ativos';
  if (id(req.query.reembolso_id)) {
    const associado = await pool.query('SELECT status FROM atendimentos WHERE reembolso_id=$1', [req.query.reembolso_id]);
    if (associado.rows[0]?.status === 'resolvido') aba = 'historico';
  }
  const r = await pool.query(`SELECT a.*,u.nome AS cliente,u.email,p.numero AS pedido_numero,COALESCE(x.sem_limites,false) AS sem_limites,x.bloqueado_ate,(SELECT COUNT(*)::int FROM atendimento_mensagens m JOIN usuarios autor ON autor.id=m.autor_id WHERE m.atendimento_id=a.id AND autor.tipo<>'admin' AND m.lida_em IS NULL) AS nao_lidas FROM atendimentos a JOIN usuarios u ON u.id=a.usuario_id LEFT JOIN pedidos p ON p.id=a.pedido_id LEFT JOIN atendimento_excecoes x ON x.usuario_id=a.usuario_id WHERE (a.status='resolvido')=$1 ORDER BY a.atualizado_em DESC LIMIT 200`, [aba === 'historico']); res.render('admin/atendimento', { atendimentos: r.rows, aba }) } catch (e) { next(e) } });
export default router;
