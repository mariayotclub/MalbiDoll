import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import Loja from '../models/lojaModel.js';
import { csrf, exigirLogin, exigirAdmin } from '../middlewares/acesso.js';
import { registrarAuditoria } from '../utils/auditoria.js';

const router = Router();

const tiposPermitidos = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif']
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extensao = path.extname(file.originalname).toLowerCase();
    const mimeEsperado = tiposPermitidos.get(extensao);

    if (!mimeEsperado || mimeEsperado !== file.mimetype) {
      return callback(new Error('Envie PNG, JPG, JPEG, WEBP ou GIF.'));
    }

    callback(null, true);
  }
});

const numero = valor => {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const moeda = valor => Number(valor).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

// Detecta o formato pelos bytes reais, não apenas pelo nome do arquivo.
function detectarTipo(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;

  if (buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer[0] === 0xff &&
    buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  if (buffer.length >= 6 &&
    ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) {
    return 'image/gif';
  }

  return null;
}

function imagemValida(arquivo) {
  if (!arquivo) return null;

  const tipoReal = detectarTipo(arquivo.buffer);
  if (!tipoReal || tipoReal !== arquivo.mimetype) {
    throw new Error('Arquivo inválido. Envie PNG, JPG, JPEG, WEBP ou GIF.');
  }

  return arquivo.buffer;
}

function dados(req) {
  const nome = String(req.body.nome || '').trim();
  const descricao = String(req.body.descricao || '').trim();
  const preco = Number(req.body.preco);

  if (!nome || nome.length > 120 || descricao.length > 5000 ||
    !Number.isFinite(preco) || preco < 0 || preco > 99999999) {
    throw new Error('Preencha nome, descrição e preço válidos.');
  }

  return {
    nome,
    descricao,
    preco,
    imagem: imagemValida(req.file),
    ativo: req.body.ativo === 'on'
  };
}

function render(res, pagina, variaveis = {}) {
  return res.render(pagina, { moeda, ...variaveis });
}

function erro(res, falha) {
  console.error('Erro na loja NP:', falha);
  return res.status(500).send('Não foi possível concluir a operação. Verifique o banco de dados.');
}

router.get('/favoritos', exigirLogin, async (req, res, next) => {
  try {
    const favoritos = await Loja.favoritos(req.usuario.id);
    res.render('user/favoritos', { favoritos });
  } catch (erro) {
    next(erro);
  }
});

router.post('/api/favoritos/:id', exigirLogin, async (req, res, next) => {
  try {
    const id = numero(req.params.id);
    const boneca = id && await Loja.obter(id);
    if (!boneca || !boneca.ativo) return res.sendStatus(404);
    const favoritado = await Loja.alternarFavorito(req.usuario.id, id);
    res.json({ favoritado });
  } catch (erro) {
    next(erro);
  }
});

// Catálogo público
router.get('/bonecas', async (req, res) => {
  try {
    render(res, 'user/bonecas', { bonecas: await Loja.listar() });
  } catch (falha) {
    erro(res, falha);
  }
});

router.get('/bonecas/:id/imagem', async (req, res) => {
  try {
    const id = numero(req.params.id);
    if (!id) return res.sendStatus(404);

    const imagem = await Loja.imagem(id);
    if (!imagem) return res.sendStatus(404);

    res.set({
      'Content-Type': detectarTipo(imagem) || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=600'
    }).send(imagem);
  } catch (falha) {
    erro(res, falha);
  }
});

router.get('/avaliacoes/:id/foto', async (req, res) => {
  try {
    const id = numero(req.params.id);
    if (!id) return res.sendStatus(404);

    const imagem = await Loja.foto(id);
    if (!imagem) return res.sendStatus(404);

    res.set({
      'Content-Type': detectarTipo(imagem) || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    }).send(imagem);
  } catch (falha) {
    erro(res, falha);
  }
});

router.get('/bonecas/:id', async (req, res) => {
  try {
    const id = numero(req.params.id);
    if (!id) return res.sendStatus(404);

    const boneca = await Loja.obter(id);
    if (!boneca || !boneca.ativo) return res.sendStatus(404);

    render(res, 'user/bonecaDetalhe', {
      boneca,
      avaliacoes: await Loja.avaliacoes(id),
      favoritado: req.usuario ? await Loja.ehFavorito(req.usuario.id, id) : false
    });
  } catch (falha) {
    erro(res, falha);
  }
});

router.post('/bonecas/:id/avaliacoes', exigirLogin, upload.single('foto'), csrf, async (req, res) => {
  try {
    const id = numero(req.params.id);
    const boneca = id && await Loja.obter(id);
    if (!boneca || !boneca.ativo) return res.sendStatus(404);

    const nome = String(req.usuario.nome).trim();
    const comentario = String(req.body.comentario || '').trim();
    const estrelas = Number(req.body.estrelas);

    if (!comentario || comentario.length > 2000 ||
      !Number.isInteger(estrelas) || estrelas < 0 || estrelas > 5) {
      return res.status(400).send('Dados da avaliação inválidos.');
    }

    await Loja.avaliar({ id, nome, usuarioId: req.usuario.id, comentario, estrelas, foto: imagemValida(req.file) });
    res.redirect(`/bonecas/${id}#avaliacoes`);
  } catch (falha) {
    res.status(400).send(falha.message);
  }
});

// Administração protegida em todas as rotas deste módulo.

// Administração de avaliações.
router.get('/admin/avaliacoes', exigirLogin, exigirAdmin, async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const busca = String(req.query.busca || '').trim().slice(0, 100);
    const status = ['todas', 'pendentes', 'respondidas'].includes(req.query.status) ? req.query.status : 'todas';
    const ordem = ['recentes', 'antigas', 'menores'].includes(req.query.ordem) ? req.query.ordem : 'recentes';
    const filtros = ['(b.nome ILIKE $1 OR a.comentario ILIKE $1 OR COALESCE(u.nome,a.nome) ILIKE $1)'];
    const valores = ['%' + busca + '%']; const nota = Number(req.query.nota);
    if (req.query.nota !== undefined && req.query.nota !== '' && Number.isInteger(nota) && nota >= 0 && nota <= 5) { valores.push(nota); filtros.push('a.estrelas=$' + valores.length) }
    if (status === 'pendentes') filtros.push('a.resposta_admin IS NULL');
    if (status === 'respondidas') filtros.push('a.resposta_admin IS NOT NULL');
    const ordenar = ordem === 'antigas' ? 'a.criado_em ASC' : ordem === 'menores' ? 'a.estrelas ASC,a.criado_em DESC' : 'a.criado_em DESC';
    const avaliacoes = (await pool.query(`SELECT a.id,a.boneca_id,b.nome AS produto,a.usuario_id,COALESCE(u.nome,a.nome) AS cliente,a.estrelas,a.comentario,a.foto IS NOT NULL AS tem_foto,a.criado_em,a.resposta_admin,a.resposta_em FROM avaliacoes_np a JOIN bonecas_np b ON b.id=a.boneca_id LEFT JOIN usuarios u ON u.id=a.usuario_id WHERE ${filtros.join(' AND ')} ORDER BY ${ordenar} LIMIT 300`, valores)).rows;
    const resumo = (await pool.query('SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE resposta_admin IS NULL)::int AS pendentes,COALESCE(ROUND(AVG(estrelas)::numeric,1),0) AS media FROM avaliacoes_np')).rows[0];
    res.render('admin/avaliacoes', { avaliacoes, resumo, busca, nota: req.query.nota || '', status, ordem });
  } catch (e) { next(e) }
});
router.post('/admin/avaliacoes/:id/responder', exigirLogin, exigirAdmin, csrf, async (req, res, next) => {
  try {
const pool = (await import('../config/database.js')).default; const id = numero(req.params.id), resposta = String(req.body.resposta || '').trim();
    if (!id || !resposta || resposta.length > 2000) return res.status(400).send('Resposta inválida.');
    const result = await pool.query('UPDATE avaliacoes_np SET resposta_admin=$1,resposta_em=NOW() WHERE id=$2', [resposta, id]);
    if (!result.rowCount) return res.sendStatus(404); res.redirect('/admin/avaliacoes');
} catch (e) { next(e) }
});
router.post('/admin/avaliacoes/:id/remover-resposta', exigirLogin, exigirAdmin, csrf, async (req, res, next) => {
  try {
const pool = (await import('../config/database.js')).default; const id = numero(req.params.id); if (!id) return res.sendStatus(400);
    await pool.query('UPDATE avaliacoes_np SET resposta_admin=NULL,resposta_em=NULL WHERE id=$1', [id]); res.redirect('/admin/avaliacoes');
} catch (e) { next(e) }
});

// Clientes e moderação de avaliações.
router.get('/admin/clientes', exigirLogin, exigirAdmin, async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const busca = String(req.query.busca || '').slice(0, 100);
    const aba = ['clientes', 'denuncias', 'arquivadas'].includes(req.query.aba) ? req.query.aba : 'clientes';
    const clientes = (await pool.query(`SELECT u.id,u.nome,u.apelido,u.email,u.criado_em,u.bloqueado_em,u.bloqueio_motivo,
   (SELECT COUNT(*)::int FROM denuncias_avaliacoes d WHERE d.denunciado_id=u.id) AS recebidas,
   (SELECT COUNT(*)::int FROM denuncias_avaliacoes d WHERE d.denunciante_id=u.id) AS realizadas
   FROM usuarios u WHERE u.tipo='cliente' AND (u.nome ILIKE $1 OR u.email ILIKE $1 OR u.apelido ILIKE $1)
   ORDER BY u.criado_em DESC LIMIT 250`, ['%' + busca + '%'])).rows;
    const denuncias = (await pool.query(`SELECT d.*,a.comentario,a.estrelas,a.boneca_id, autor.nome AS denunciado_nome, reporter.nome AS denunciante_nome
   FROM denuncias_avaliacoes d JOIN avaliacoes_np a ON a.id=d.avaliacao_id
   JOIN usuarios autor ON autor.id=d.denunciado_id JOIN usuarios reporter ON reporter.id=d.denunciante_id
   WHERE d.status = $1 ORDER BY d.criado_em DESC LIMIT 250`, [aba === 'arquivadas' ? 'arquivada' : 'pendente'])).rows;
    res.render('admin/clientes', { clientes, denuncias, busca, aba });
  } catch (e) { next(e) }
});
router.post('/admin/clientes/:id/bloqueio', exigirLogin, exigirAdmin, csrf, async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const id = numero(req.params.id), acao = String(req.body.acao || '');
    const motivos = ['fraude', 'seguranca', 'abuso', 'conteudo', 'termos', 'solicitacao'];
    if (!id || !['bloquear', 'desbloquear'].includes(acao) || acao === 'bloquear' && !motivos.includes(req.body.motivo)) return res.sendStatus(400);
    await pool.query(`UPDATE usuarios SET bloqueado_em=CASE WHEN $1='bloquear' THEN NOW() ELSE NULL END,
   bloqueio_motivo=CASE WHEN $1='bloquear' THEN $2 ELSE NULL END,
   bloqueio_detalhes=CASE WHEN $1='bloquear' THEN $3 ELSE NULL END WHERE id=$4 AND tipo='cliente'`,
      [acao, acao === 'bloquear' ? req.body.motivo : null, String(req.body.detalhes || '').slice(0, 200), id]);
    res.redirect('/admin/clientes');
  } catch (e) { next(e) }
});
router.post('/avaliacoes/:id/denunciar', exigirLogin, csrf, async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const id = numero(req.params.id), motivo = String(req.body.motivo || ''), detalhes = String(req.body.detalhes || '');
    if (!id || !['spam', 'ofensa', 'assedio', 'discriminacao', 'improprio', 'outro'].includes(motivo) || detalhes.length > 50) return res.sendStatus(400);
    const avaliacao = (await pool.query('SELECT usuario_id,boneca_id FROM avaliacoes_np WHERE id=$1', [id])).rows[0];
    if (!avaliacao || !avaliacao.usuario_id || avaliacao.usuario_id === req.usuario.id) return res.sendStatus(403);
    await pool.query(`INSERT INTO denuncias_avaliacoes(avaliacao_id,denunciante_id,denunciado_id,motivo,detalhes)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(avaliacao_id,denunciante_id) DO NOTHING`, [id, req.usuario.id, avaliacao.usuario_id, motivo, detalhes]);
    res.redirect('/bonecas/' + avaliacao.boneca_id + '#avaliacoes');
  } catch (e) { next(e) }
});
router.post('/admin/denuncias/:id/desarquivar', exigirLogin, exigirAdmin, csrf, async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const id = numero(req.params.id);
    if (!id) return res.sendStatus(400);
    const resultado = await pool.query(`UPDATE denuncias_avaliacoes SET status='pendente',analisado_em=NULL,administrador_id=NULL
  WHERE id=$1 AND status='arquivada' RETURNING id`, [id]);
    if (!resultado.rowCount) return res.sendStatus(409);
    res.redirect('/admin/clientes?aba=arquivadas');
  } catch (e) { next(e) }
});

router.post('/admin/denuncias/:id/decisao', exigirLogin, exigirAdmin, csrf, async (req, res, next) => {
  const pool = (await import('../config/database.js')).default, client = await pool.connect();
  try {
    const id = numero(req.params.id), decisao = String(req.body.decisao || '');
    if (!id || !['arquivada', 'removida'].includes(decisao)) return res.sendStatus(400);
    await client.query('BEGIN');
    const d = (await client.query('SELECT avaliacao_id FROM denuncias_avaliacoes WHERE id=$1 AND status=$2 FOR UPDATE', [id, 'pendente'])).rows[0];
    if (!d) { await client.query('ROLLBACK'); return res.sendStatus(409) }
    await client.query('UPDATE denuncias_avaliacoes SET status=$1,analisado_em=NOW(),administrador_id=$2 WHERE id=$3', [decisao, req.usuario.id, id]);
    if (decisao === 'removida') await client.query('DELETE FROM avaliacoes_np WHERE id=$1', [d.avaliacao_id]);
    await client.query('COMMIT'); res.redirect('/admin/clientes?aba=denuncias');
  } catch (e) { await client.query('ROLLBACK'); next(e) } finally { client.release() }
});

router.use('/admin', exigirLogin, exigirAdmin);
router.get('/admin', async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const periodo = req.query.periodo === '12' ? 12 : 6;
    const [
      resumo,
      recentes,
      receita,
      tipos,
      maisVendidos,
      maisEscolhidos,
      entregues,
      atividades
    ] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM pedidos) AS pedidos,
        (SELECT COUNT(*)::int FROM pedidos WHERE pagamento_status = 'pago') AS pagos,
        (SELECT COALESCE(SUM(total), 0)::numeric FROM pedidos WHERE pagamento_status = 'pago') AS faturamento,
        (SELECT COUNT(*)::int FROM pedidos WHERE pagamento_status <> 'pago') AS pendentes,
        (SELECT COUNT(*)::int FROM bonecas_np WHERE ativo = TRUE) AS bonecas,
        (SELECT COUNT(*)::int FROM itens) AS itens,
        (SELECT COUNT(*)::int FROM usuarios WHERE tipo = 'cliente') AS clientes,
        (SELECT COUNT(*)::int FROM pedidos WHERE producao_status = 'entregue') AS entregues`),
      pool.query(`SELECT numero, cliente_nome, tipo, total, pagamento_status,
        producao_status, criado_em FROM pedidos
        ORDER BY criado_em DESC, id DESC LIMIT 8`),
      pool.query(`SELECT TO_CHAR(meses.mes, 'MM/YY') AS rotulo,
        COALESCE(SUM(p.total), 0)::numeric AS total
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - ($1::int - 1) * INTERVAL '1 month',
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS meses(mes)
        LEFT JOIN pedidos p ON p.criado_em >= meses.mes
          AND p.criado_em < meses.mes + INTERVAL '1 month'
          AND p.pagamento_status = 'pago'
        GROUP BY meses.mes ORDER BY meses.mes`, [periodo]),
      pool.query(`SELECT tipo, COUNT(*)::int AS quantidade,
        COALESCE(SUM(total), 0)::numeric AS faturamento
        FROM pedidos WHERE pagamento_status = 'pago'
        GROUP BY tipo`),
      pool.query(`SELECT item->>'nome' AS nome,
        SUM(COALESCE((item->>'quantidade')::int, 1))::int AS quantidade
        FROM pedidos p CROSS JOIN LATERAL jsonb_array_elements(p.itens) AS item
        WHERE p.tipo = 'np' AND p.pagamento_status = 'pago'
        GROUP BY item->>'nome' ORDER BY quantidade DESC, nome ASC LIMIT 5`),
      pool.query(`SELECT item->>'nome' AS nome,
        SUM(COALESCE((item->>'quantidade')::int, 1))::int AS quantidade
        FROM pedidos p CROSS JOIN LATERAL jsonb_array_elements(p.itens) AS item
        WHERE p.tipo = 'personalizada' AND p.pagamento_status = 'pago'
        GROUP BY item->>'nome' ORDER BY quantidade DESC, nome ASC LIMIT 5`),
      pool.query(`SELECT numero, cliente_nome, tipo, total, entregue_em
        FROM pedidos WHERE producao_status = 'entregue'
        ORDER BY entregue_em DESC NULLS LAST, id DESC LIMIT 8`),
      pool.query(`SELECT acao, descricao, responsavel, criado_em FROM (
          SELECT a.acao::text AS acao, a.descricao,
            COALESCE(u.nome, 'Conta removida') AS responsavel, a.criado_em
          FROM auditoria_admin a
          LEFT JOIN usuarios u ON u.id = a.administrador_id
          UNION ALL
          SELECT 'Pagamento'::text AS acao,
            CONCAT('Pedido ', p.numero, ': ', h.status_anterior, ' → ', h.status_novo) AS descricao,
            COALESCE(u.nome, 'Sistema') AS responsavel, h.criado_em
          FROM pagamento_historico h
          JOIN pedidos p ON p.id = h.pedido_id
          LEFT JOIN usuarios u ON u.id = h.administrador_id
        ) historico ORDER BY criado_em DESC LIMIT 12`)
    ]);

    res.render('admin/painel', {
      indicadores: resumo.rows[0],
      recentes: recentes.rows,
      receitaMensal: receita.rows,
      vendasPorTipo: tipos.rows,
      maisVendidos: maisVendidos.rows,
      maisEscolhidos: maisEscolhidos.rows,
      entregues: entregues.rows,
      atividades: atividades.rows,
      periodo,
      moeda
    });
  } catch (erro) {
    next(erro);
  }
});

router.get('/admin/administradores', async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const { rows: administradores } = await pool.query(`
      SELECT id, nome, email, criado_em, bloqueado_em
      FROM usuarios WHERE tipo = 'admin'
      ORDER BY criado_em ASC, id ASC
    `);
    res.render('admin/administradores', {
      administradores,
      mensagem: String(req.query.msg || ''),
      moeda
    });
  } catch (erro) {
    next(erro);
  }
});

router.post('/admin/administradores/adicionar', csrf, async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 255);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.redirect('/admin/administradores?msg=invalido');
    }

    const { rows } = await pool.query(
      'SELECT id, nome, tipo FROM usuarios WHERE email = $1', [email]
    );
    const conta = rows[0];
    if (!conta) return res.redirect('/admin/administradores?msg=inexistente');
    if (conta.tipo === 'admin') return res.redirect('/admin/administradores?msg=existente');

    const atualizado = await pool.query(
      `UPDATE usuarios SET tipo = 'admin'
       WHERE id = $1 AND tipo = 'cliente' RETURNING id`, [conta.id]
    );
    if (!atualizado.rowCount) return res.redirect('/admin/administradores?msg=existente');

    await registrarAuditoria(
      req.usuario.id, 'Administrador adicionado', 'usuarios', conta.id,
      `Permissão administrativa concedida a ${conta.nome}.`
    );
    res.redirect('/admin/administradores?msg=adicionado');
  } catch (erro) {
    next(erro);
  }
});

router.post('/admin/administradores/:id/remover', csrf, async (req, res, next) => {
  const id = numero(req.params.id);
  if (!id) return res.sendStatus(400);
  if (id === req.usuario.id) return res.redirect('/admin/administradores?msg=protegido');

  const pool = (await import('../config/database.js')).default;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
    const { rows } = await client.query(
      `SELECT id, nome FROM usuarios WHERE id = $1 AND tipo = 'admin'`, [id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.redirect('/admin/administradores?msg=nao_encontrado');
    }
    const quantidade = await client.query(
      `SELECT COUNT(*)::int AS total FROM usuarios WHERE tipo = 'admin'`
    );
    if (quantidade.rows[0].total <= 1) {
      await client.query('ROLLBACK');
      return res.redirect('/admin/administradores?msg=ultimo');
    }
    await client.query(`UPDATE usuarios SET tipo = 'cliente' WHERE id = $1`, [id]);
    await client.query('COMMIT');

    await registrarAuditoria(
      req.usuario.id, 'Administrador removido', 'usuarios', id,
      `Permissão administrativa removida de ${rows[0].nome}.`
    );
    res.redirect('/admin/administradores?msg=removido');
  } catch (erro) {
    await client.query('ROLLBACK').catch(() => {});
    next(erro);
  } finally {
    client.release();
  }
});

// Pagamentos de demonstração: os valores não representam dinheiro recebido.
router.get('/admin/devolucoes', exigirAdmin, async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const { rows: solicitacoes } = await pool.query(`
      SELECT s.*, p.numero, p.cliente_nome, p.cliente_email, p.total,
           p.tipo, p.producao_status
      FROM solicitacoes_reembolso s
      JOIN pedidos p ON p.id=s.pedido_id
      ORDER BY CASE WHEN s.status='pendente' THEN 0 ELSE 1 END,
           s.criado_em DESC`);
    res.render('admin/devolucoes', { solicitacoes, moeda });
  } catch (erro) { next(erro); }
});

router.get('/admin/pagamentos', async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const aba = ['visao', 'transacoes', 'reembolsos'].includes(req.query.aba) ? req.query.aba : 'visao';
    const status = ['pago', 'aprovado', 'aguardando', 'pendente', 'recusado', 'reembolsado'].includes(req.query.status) ? req.query.status : '';
    const busca = String(req.query.busca || '').trim().slice(0, 100);
    const inicio = /^\d{4}-\d{2}-\d{2}$/.test(req.query.inicio || '') ? req.query.inicio : '';
    const fim = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fim || '') ? req.query.fim : '';
    const pagina = Math.max(1, Math.min(100000, parseInt(req.query.pagina, 10) || 1));
    const periodo = req.query.periodo === '12' ? 12 : 6;
    const filtros = [status, `%${busca}%`, inicio || null, fim || null];
    const where = `($1 = '' OR pagamento_status = $1) AND
      ($2 = '%%' OR numero ILIKE $2 OR cliente_nome ILIKE $2 OR cliente_email ILIKE $2) AND
      ($3::date IS NULL OR criado_em >= $3::date) AND
      ($4::date IS NULL OR criado_em < ($4::date + INTERVAL '1 day'))`;
    const [resumo, contagem, lista, historico, solicitacoes, receitaResultado, statusResultado] = await Promise.all([
      pool.query(`SELECT
        COALESCE(SUM(total) FILTER (WHERE pagamento_status IN ('pago','aprovado')),0) AS recebido,
        COALESCE(SUM(total) FILTER (WHERE pagamento_status IN ('aguardando','pendente')),0) AS pendente,
        COALESCE(SUM(total) FILTER (WHERE pagamento_status = 'reembolsado'),0) AS reembolsado,
        COUNT(*) FILTER (WHERE pagamento_status IN ('pago','aprovado'))::int AS aprovados
        FROM pedidos`),
      pool.query(`SELECT COUNT(*)::int AS total FROM pedidos WHERE ${where}`, filtros),
      pool.query(`SELECT id, numero, cliente_nome, cliente_email, total, pagamento_metodo, pagamento_status, pago_em, criado_em
        FROM pedidos WHERE ${where} ORDER BY criado_em DESC, id DESC LIMIT 20 OFFSET $5`, [...filtros, (pagina - 1) * 20]),
      pool.query(`SELECT h.*, p.numero, p.cliente_nome FROM pagamento_historico h JOIN pedidos p ON p.id=h.pedido_id ORDER BY h.criado_em DESC, h.id DESC LIMIT 100`),
      pool.query(`SELECT s.*, p.numero, p.cliente_nome, p.total FROM solicitacoes_reembolso s JOIN pedidos p ON p.id=s.pedido_id ORDER BY s.criado_em DESC LIMIT 100`),
      pool.query(`WITH meses AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - ($1::int - 1) * INTERVAL '1 month',
          date_trunc('month', CURRENT_DATE), INTERVAL '1 month'
        )::date AS mes
      )
      SELECT to_char(meses.mes, 'MM/YYYY') AS rotulo,
           COALESCE(SUM(p.total) FILTER (WHERE p.pagamento_status IN ('pago', 'aprovado')), 0) AS total
      FROM meses LEFT JOIN pedidos p
        ON p.criado_em >= meses.mes AND p.criado_em < meses.mes + INTERVAL '1 month'
      GROUP BY meses.mes ORDER BY meses.mes`, [periodo]),
      pool.query(`SELECT CASE
        WHEN pagamento_status IN ('pago', 'aprovado') THEN 'Aprovados'
        WHEN pagamento_status IN ('aguardando', 'pendente') THEN 'Pendentes'
        WHEN pagamento_status = 'recusado' THEN 'Recusados'
        WHEN pagamento_status = 'reembolsado' THEN 'Reembolsados'
        ELSE 'Outros' END AS status, COUNT(*)::int AS quantidade
        FROM pedidos
        WHERE criado_em >= date_trunc('month', CURRENT_DATE) - ($1::int - 1) * INTERVAL '1 month'
          AND criado_em < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY 1`, [periodo])
    ]);
    res.render('admin/pagamentos', {
      aba, status, busca, inicio, fim, pagina, periodo,
      receitaMensal: receitaResultado.rows, statusGrafico: statusResultado.rows,
      paginas: Math.max(1, Math.ceil(contagem.rows[0].total / 20)),
      indicadores: resumo.rows[0], transacoes: lista.rows, historico: historico.rows, solicitacoes: solicitacoes.rows, moeda,
      mensagem: ['aprovado', 'recusado', 'reembolsado'].includes(req.query.msg) ? req.query.msg : ''
    });
  } catch (erro) { next(erro); }
});

router.post('/admin/pagamentos/reembolsos/:id/decisao', exigirAdmin, csrf, async (req, res, next) => {
  const pool = (await import('../config/database.js')).default;
  const cliente = await pool.connect();
  try {
    const id = numero(req.params.id);
    const decisao = String(req.body.decisao || '');
    if (!id || !['aprovado', 'recusado'].includes(decisao)) return res.sendStatus(400);
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(`SELECT s.pedido_id, p.pagamento_status, p.total FROM solicitacoes_reembolso s
      JOIN pedidos p ON p.id=s.pedido_id WHERE s.id=$1 AND s.status='pendente' FOR UPDATE OF s,p`, [id]);
    if (!rows.length) { await cliente.query('ROLLBACK'); return res.sendStatus(409); }
    if (decisao === 'aprovado' && !['pago', 'aprovado'].includes(rows[0].pagamento_status)) { await cliente.query('ROLLBACK'); return res.sendStatus(409); }
    await cliente.query('UPDATE solicitacoes_reembolso SET status=$1, analisado_em=NOW() WHERE id=$2', [decisao, id]);
    if (decisao === 'aprovado') {
      await cliente.query("UPDATE pedidos SET pagamento_status='reembolsado' WHERE id=$1", [rows[0].pedido_id]);
      await cliente.query(`INSERT INTO pagamento_historico (pedido_id,status_anterior,status_novo,valor,administrador_id,observacao) VALUES ($1,$2,'reembolsado',$3,$4,'Solicitação de cliente aprovada')`, [rows[0].pedido_id, rows[0].pagamento_status, rows[0].total, req.usuario.id]);
    }
    await cliente.query('COMMIT');
    res.redirect('/admin/devolucoes');
  } catch (erro) { await cliente.query('ROLLBACK'); next(erro); } finally { cliente.release(); }
});

router.post('/admin/pagamentos/:id/status', csrf, async (req, res, next) => {
  const pool = (await import('../config/database.js')).default;
  const cliente = await pool.connect();
  try {
    const id = numero(req.params.id);
    const novo = String(req.body.status || '');
    if (!id || !['pago', 'recusado', 'reembolsado'].includes(novo)) return res.sendStatus(400);
    await cliente.query('BEGIN');
    const { rows } = await cliente.query('SELECT pagamento_status, total FROM pedidos WHERE id=$1 FOR UPDATE', [id]);
    if (!rows.length) { await cliente.query('ROLLBACK'); return res.sendStatus(404); }
    const anterior = rows[0].pagamento_status;
    const aguardando = ['aguardando', 'pendente', 'recusado'];
    const permitido = novo === 'reembolsado' ? ['pago', 'aprovado'].includes(anterior) : aguardando.includes(anterior);
    if (!permitido || anterior === novo) { await cliente.query('ROLLBACK'); return res.status(409).send('Alteração de pagamento não permitida.'); }
    await cliente.query(`UPDATE pedidos SET pagamento_status=$1, pago_em=CASE WHEN $1='pago' THEN NOW() ELSE pago_em END WHERE id=$2`, [novo, id]);
    await cliente.query(`INSERT INTO pagamento_historico (pedido_id, status_anterior, status_novo, valor, administrador_id, observacao)
      VALUES ($1,$2,$3,$4,$5,$6)`, [id, anterior, novo, rows[0].total, req.usuario.id, String(req.body.observacao || '').trim().slice(0, 200)]);
    await cliente.query('COMMIT');
    res.redirect('/admin/pagamentos?aba=' + (novo === 'reembolsado' ? 'reembolsos' : 'transacoes') + '&msg=' + (novo === 'pago' ? 'aprovado' : novo));
  } catch (erro) { await cliente.query('ROLLBACK'); next(erro); }
  finally { cliente.release(); }
});

router.get('/admin/pagamentos/exportar', async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const { rows } = await pool.query(`SELECT numero, cliente_nome, cliente_email, total, pagamento_metodo, pagamento_status, criado_em, pago_em FROM pedidos ORDER BY criado_em DESC`);
    const csv = [['Pedido', 'Cliente', 'Email', 'Valor (BRL)', 'Metodo', 'Status', 'Criado em', 'Pago em'], ...rows.map(p => [p.numero, p.cliente_nome, p.cliente_email, p.total, p.pagamento_metodo, p.pagamento_status, p.criado_em?.toISOString(), p.pago_em?.toISOString()])]
      .map(linha => linha.map(valor => '"' + String(valor ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"').join(';')).join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="malbidoll-pagamentos.csv"');
    res.send('\uFEFF' + csv);
  } catch (erro) { next(erro); }
});

router.get('/admin/pedidos', async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const tipo = req.query.tipo === 'personalizada' ? 'personalizada' : 'np';
    const status = String(req.query.status || '');
    const busca = String(req.query.busca || '').trim().slice(0, 100);
    const pagina = Math.max(1, Math.min(100000, Number.parseInt(req.query.pagina, 10) || 1));
    const filtros = [tipo, status, `%${busca}%`];
    const where = `tipo = $1 AND producao_status NOT IN ('enviado', 'entregue', 'cancelado') AND ($2 = '' OR producao_status = $2)
      AND ($3 = '%%' OR numero ILIKE $3 OR cliente_nome ILIKE $3)`;
    const total = await pool.query(`SELECT COUNT(*)::int AS total FROM pedidos WHERE ${where}`, filtros);
    const resultado = await pool.query(`SELECT * FROM pedidos WHERE ${where}
      ORDER BY criado_em ASC, id ASC LIMIT 20 OFFSET $4`, [...filtros, (pagina - 1) * 20]);
    res.render('admin/pedidos', {
      pedidos: resultado.rows, tipo, status, busca, pagina,
      paginas: Math.max(1, Math.ceil(total.rows[0].total / 20)), moeda
    });
  } catch (erro) { next(erro); }
});

const etapasPedido = {
  np: ['separado', 'conferido', 'embalado', 'enviado'],
  personalizada: ['em_producao', 'producao_finalizada', 'conferido', 'embalado', 'enviado']
};

router.post('/admin/pedidos/:id/status', async (req, res, next) => {
  const pool = (await import('../config/database.js')).default;
  const cliente = await pool.connect();
  try {
    const id = numero(req.params.id);
    const etapa = Number(req.body.etapa);
    if (!id || !Number.isInteger(etapa)) return res.sendStatus(400);

    await cliente.query('BEGIN');
    const resultado = await cliente.query('SELECT tipo, etapa_producao, producao_status FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    const pedido = resultado.rows[0];
    if (!pedido || ['enviado', 'entregue', 'cancelado'].includes(pedido.producao_status)) {
      await cliente.query('ROLLBACK');
      return res.sendStatus(404);
    }

    const etapas = etapasPedido[pedido.tipo];
    const atual = Number(pedido.etapa_producao);
    if (!etapas || etapa < 0 || etapa > etapas.length) {
      await cliente.query('ROLLBACK');
      return res.status(400).send('Etapa de produção inválida.');
    }
    if (etapa === etapas.length && req.body.confirmar_envio !== 'sim') {
      await cliente.query('ROLLBACK');
      return res.status(400).send('Confirme o envio antes de salvar.');
    }
    const status = etapa === 0 ? 'aguardando' : etapas[etapa - 1];
    await cliente.query(`UPDATE pedidos SET etapa_producao = $1, producao_status = $2,
      enviado_em = CASE WHEN $2 = 'enviado' THEN NOW() ELSE enviado_em END
      WHERE id = $3`, [etapa, status, id]);
    await cliente.query('COMMIT');
    if (etapa !== atual) {
      await registrarAuditoria(
        req.usuario.id, 'Produção atualizada', 'pedidos', id,
        `Etapa de produção do pedido #${id} alterada para ${status}.`
      );
    }
    res.redirect('/admin/pedidos?tipo=' + encodeURIComponent(pedido.tipo));
  } catch (erro) {
    await cliente.query('ROLLBACK').catch(() => { });
    next(erro);
  } finally {
    cliente.release();
  }
});

router.get('/admin/entregas', async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const resultado = await pool.query(`SELECT * FROM pedidos WHERE producao_status IN ('enviado', 'entregue')
      ORDER BY enviado_em ASC NULLS LAST, id ASC`);
    res.render('admin/entregas', {
      emAndamento: resultado.rows.filter(p => p.producao_status === 'enviado'),
      historico: resultado.rows.filter(p => p.producao_status === 'entregue'), moeda
    });
  } catch (erro) { next(erro); }
});

router.post('/admin/entregas/:id/entregue', csrf, async (req, res, next) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const id = numero(req.params.id);
    if (!id) return res.sendStatus(400);
    const entregue = await pool.query(`UPDATE pedidos SET producao_status = 'entregue', entregue_em = NOW(),
      entrega_confirmada_por = 'administrador'
      WHERE id = $1 AND producao_status = 'enviado' RETURNING numero`, [id]);
    if (entregue.rowCount) {
      await registrarAuditoria(
        req.usuario.id, 'Entrega confirmada', 'pedidos', id,
        `Entrega confirmada para o pedido ${entregue.rows[0].numero}.`
      );
    }
    res.redirect('/admin/entregas?aba=historico');
  } catch (erro) { next(erro); }
});

router.get('/admin/bonecas', async (req, res) => {
  try {
    render(res, 'admin/bonecas', {
      bonecas: await Loja.listar(false),
      mensagem: req.query.msg || ''
    });
  } catch (falha) {
    erro(res, falha);
  }
});

router.post('/admin/bonecas', upload.single('imagem'), csrf, async (req, res) => {
  try {
    const boneca = dados(req);
    if (!boneca.imagem) return res.status(400).send('Imagem obrigatória no cadastro.');

    const criada = await Loja.criar(boneca);
    await registrarAuditoria(
      req.usuario.id, 'Boneca cadastrada', 'bonecas_np', criada.id,
      `Boneca pronta cadastrada: ${boneca.nome}.`
    );
    res.redirect('/admin/bonecas?msg=criada');
  } catch (falha) {
    res.status(400).send(falha.message);
  }
});

router.post('/admin/bonecas/:id/editar', upload.single('imagem'), csrf, async (req, res) => {
  try {
    const id = numero(req.params.id);
    if (!id) return res.sendStatus(404);

    const anterior = await Loja.obter(id);
    if (!anterior) return res.sendStatus(404);
    const boneca = dados(req);
    const alteradas = await Loja.editar(id, boneca);
    if (!alteradas) return res.sendStatus(404);

    const mudouPreco = Number(anterior.preco) !== Number(boneca.preco);
    await registrarAuditoria(
      req.usuario.id,
      mudouPreco ? 'Preço alterado' : 'Boneca editada',
      'bonecas_np', id,
      mudouPreco
        ? `${boneca.nome}: ${moeda(anterior.preco)} → ${moeda(boneca.preco)}.`
        : `Boneca pronta atualizada: ${boneca.nome}.`
    );
    res.redirect('/admin/bonecas?msg=editada');
  } catch (falha) {
    res.status(400).send(falha.message);
  }
});

router.post('/admin/bonecas/:id/excluir', async (req, res) => {
  try {
    const id = numero(req.params.id);
    if (!id) return res.sendStatus(404);

    const anterior = await Loja.obter(id);
    if (!anterior) return res.sendStatus(404);
    const excluidas = await Loja.excluir(id);
    if (!excluidas) return res.sendStatus(404);

    await registrarAuditoria(
      req.usuario.id, 'Boneca excluída', 'bonecas_np', id,
      `Boneca pronta excluída: ${anterior.nome}.`
    );
    res.redirect('/admin/bonecas?msg=excluida');
  } catch (falha) {
    erro(res, falha);
  }
});

router.get('/admin/itens', async (req, res) => {
  try {
    render(res, 'admin/itens', { itens: await Loja.itens() });
  } catch (falha) {
    erro(res, falha);
  }
});

router.get('/admin/armario', (req, res) => res.redirect('/armario'));

// Consulta dos dados atuais do produto para inclusão no carrinho.
router.get('/api/bonecas/:id', async (req, res) => {
  try {
    const id = numero(req.params.id);
    const boneca = id && await Loja.obter(id);
    if (!boneca || !boneca.ativo) return res.sendStatus(404);

    res.json({
      id: boneca.id,
      nome: boneca.nome,
      preco: Number(boneca.preco),
      imagem: `/bonecas/${boneca.id}/imagem`
    });
  } catch (falha) {
    erro(res, falha);
  }
});

router.use((falha, req, res, next) => {
  if (falha instanceof multer.MulterError) {
    return res.status(400).send('Arquivo grande demais (limite 3 MB).');
  }
  if (falha.message === 'Envie PNG, JPG, JPEG, WEBP ou GIF.') {
    return res.status(400).send('Envie apenas PNG, JPG, JPEG, WEBP ou GIF (até 3 MB).');
  }

  // Outros erros devem seguir para o tratamento normal do Express.
  console.error('Erro na rota da loja:', falha);
  if (falha.code === '42P01' || falha.code === '42703') {
    return res.status(500).send(
      'O banco de dados precisa ser atualizado. Execute config/correcao_favoritos_avaliacoes.sql no PostgreSQL.'
    );
  }
  return next(falha);
});

export default router;
