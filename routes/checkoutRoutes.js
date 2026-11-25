import { Router } from "express";
import crypto from "node:crypto";
import pool from "../config/database.js";
import { Usuario } from "../models/usuarioModel.js";
import { exigirLogin, csrf } from "../middlewares/acesso.js";

const router = Router();
const fretes = { economico: 12.9, expresso: 24.9 };
const pagamentos = ["pix", "cartao", "boleto"];
const moeda = valor => Number(valor).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

async function buscarItens(ids) {
  const resultado = await pool.query(
    "SELECT id, nome, preco, miniatura FROM itens WHERE id = ANY($1::int[]) ORDER BY id",
    [ids]
  );
  return resultado.rows.map(item => ({
    id: item.id,
    nome: item.nome,
    preco: Number(item.preco),
    imagem: item.miniatura || null,
    quantidade: 1
  }));
}

router.post("/checkout/preparar", exigirLogin, async (req, res, next) => {
  try {
    const recebidos = req.body.itens;
    if (!Array.isArray(recebidos) || recebidos.length > 100 ||
      !recebidos.every(id => Number.isSafeInteger(id) && id > 0)) {
      return res.status(400).json({ erro: "Seleção inválida." });
    }

    const ids = [...new Set(recebidos)];
    const itens = await buscarItens(ids);
    if (!ids.length || itens.length !== ids.length) {
      return res.status(400).json({ erro: "Selecione itens válidos." });
    }

    req.session.checkoutItens = ids;
    res.json({ destino: "/checkout" });
  } catch (erro) {
    next(erro);
  }
});

router.post("/checkout/preparar-carrinho", exigirLogin, async (req, res, next) => {
  try {
    const recebidos = req.body.itens;
    if (!Array.isArray(recebidos) || !recebidos.length || recebidos.length > 100 ||
      !recebidos.every(item => Number.isSafeInteger(item.id) && item.id > 0 &&
        Number.isSafeInteger(item.qtd) && item.qtd >= 1 && item.qtd <= 99)) {
      return res.status(400).json({ erro: "Carrinho inválido." });
    }
    const ids = [...new Set(recebidos.map(item => item.id))];
    const { rows } = await pool.query(
      "SELECT id FROM bonecas_np WHERE id = ANY($1::int[]) AND ativo = TRUE", [ids]
    );
    if (rows.length !== ids.length) {
      return res.status(400).json({ erro: "Há produtos indisponíveis no carrinho." });
    }
    req.session.checkoutCarrinho = recebidos;
    delete req.session.checkoutItens;
    res.json({ destino: "/checkout" });
  } catch (erro) { next(erro); }
});

async function itensDoCheckout(req) {
  if (!req.session.checkoutCarrinho) {
    return { itens: await buscarItens(req.session.checkoutItens || []), tipo: "personalizada" };
  }
  const carrinho = req.session.checkoutCarrinho;
  const { rows } = await pool.query(
    "SELECT id, nome, preco FROM bonecas_np WHERE id = ANY($1::int[]) AND ativo = TRUE",
    [carrinho.map(item => item.id)]
  );
  const itens = carrinho.flatMap(item => {
    const produto = rows.find(row => row.id === item.id);
    return produto ? [{
      id: produto.id, nome: produto.nome, preco: Number(produto.preco) * item.qtd,
      preco_unitario: Number(produto.preco), quantidade: item.qtd,
      imagem: `/bonecas/${produto.id}/imagem`
    }] : [];
  });
  return { itens: itens.length === carrinho.length ? itens : [], tipo: "np" };
}

router.get("/checkout", exigirLogin, async (req, res, next) => {
  try {
    const { itens } = await itensDoCheckout(req);
    const enderecos = await Usuario.enderecos(req.usuario.id);
    res.render("user/checkout", {
      itens,
      enderecos,
      moeda,
      fretes,
      erroCheckout: req.session.erroCheckout || null
    });
    delete req.session.erroCheckout;
  } catch (erro) {
    next(erro);
  }
});

router.post("/checkout/endereco", exigirLogin, async (req, res, next) => {
  try {
    const campos = ["cep", "logradouro", "numero", "bairro", "cidade", "estado"];
    const dados = Object.fromEntries(
      ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "estado"]
        .map(campo => [campo, String(req.body[campo] || "").trim()])
    );
    if (campos.some(campo => !dados[campo]) ||
      !/^\d{5}-?\d{3}$/.test(dados.cep) ||
      !/^[A-Za-z]{2}$/.test(dados.estado) ||
      Object.values(dados).some(valor => valor.length > 150)) {
      req.session.erroCheckout = "Preencha um endereço válido.";
      return res.redirect("/checkout");
    }

    await Usuario.salvarEndereco(req.usuario.id, {
      ...dados,
      apelido: null,
      principal: req.body.principal === "on"
    });
    res.redirect("/checkout");
  } catch (erro) {
    next(erro);
  }
});

router.post("/checkout/comprar", exigirLogin, async (req, res, next) => {
  try {
    const ids = req.session.checkoutItens || [];
    const { itens, tipo } = await itensDoCheckout(req);
    const nome = String(req.body.nome || "").trim();
    const sobrenome = String(req.body.sobrenome || "").trim();
    if (!/^[\p{L}][\p{L} '\-]{0,79}$/u.test(nome) ||
      !/^[\p{L}][\p{L} '\-]{0,79}$/u.test(sobrenome)) {
      req.session.erroCheckout = "Informe nome e sobrenome válidos.";
      return res.redirect("/checkout");
    }
    const enderecoId = Number(Array.isArray(req.body.endereco_id) ? req.body.endereco_id[0] : req.body.endereco_id);
    const enderecos = await Usuario.enderecos(req.usuario.id);
    const endereco = enderecos.find(item => Number(item.id) === enderecoId);
    const frete = String(Array.isArray(req.body.frete) ? req.body.frete[0] : (req.body.frete || ""));
    const pagamento = String(Array.isArray(req.body.pagamento) ? req.body.pagamento[0] : (req.body.pagamento || ""));

    if (!itens.length || (tipo === "personalizada" && itens.length !== ids.length) || !endereco ||
      !Object.hasOwn(fretes, frete) || !pagamentos.includes(pagamento)) {
      req.session.erroCheckout = "Confira os itens, endereço, frete e pagamento antes de comprar.";
      return res.redirect("/checkout");
    }

    const subtotal = itens.reduce((soma, item) => soma + item.preco, 0);
    const numero = `MB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const client = await pool.connect();
    let pedidoId;
    try {
      await client.query("BEGIN");
      const resultado = await client.query(`
        INSERT INTO pedidos (numero, usuario_id, cliente_nome, cliente_email, tipo,
          itens, endereco, frete, valor_frete, total, pagamento_metodo, pagamento_status, pago_em)
        VALUES ($1,$2,$3,$4,$11,$5,$6,$7,$8,$9,$10,'pago',NOW()) RETURNING id
      `, [numero, req.usuario.id, `${nome} ${sobrenome}`, req.usuario.email,
        JSON.stringify(itens), JSON.stringify({
          logradouro: endereco.logradouro, numero: endereco.numero,
          bairro: endereco.bairro, cidade: endereco.cidade,
          estado: endereco.estado, cep: endereco.cep
        }), frete, fretes[frete], subtotal + fretes[frete], pagamento, tipo]);
      pedidoId = resultado.rows[0].id;
      await client.query("COMMIT");
    } catch (erro) {
      await client.query("ROLLBACK");
      throw erro;
    } finally {
      client.release();
    }

    // Simulação local: nenhuma transação ou API externa é utilizada.
    req.session.ultimoPedidoNumero = numero;
    delete req.session.checkoutItens;
    delete req.session.checkoutCarrinho;
    req.session.save(erro => {
      if (erro) return next(erro);
      res.redirect("/compra/confirmacao");
    });
  } catch (erro) {
    next(erro);
  }
});

router.get("/compra/confirmacao", exigirLogin, async (req, res, next) => {
  try {
    const pedido = (await pool.query(
      "SELECT * FROM pedidos WHERE numero=$1 AND usuario_id=$2",
      [req.session.ultimoPedidoNumero || "", req.usuario.id]
    )).rows[0];
    if (!pedido) return res.redirect("/");
    res.render("user/compraConfirmada", { pedido });
  } catch (erro) { next(erro); }
});

router.get("/pedidos/:numero", exigirLogin, async (req, res, next) => {
  try {
    const pedido = (await pool.query(
      "SELECT * FROM pedidos WHERE numero=$1 AND usuario_id=$2",
      [req.params.numero, req.usuario.id]
    )).rows[0];
    if (!pedido) return res.sendStatus(404);
    const solicitacao = (await pool.query('SELECT motivo, detalhes, status, criado_em FROM solicitacoes_reembolso WHERE pedido_id=$1 AND usuario_id=$2', [pedido.id, req.usuario.id])).rows[0] || null;
    res.render("user/detalhesPedido", { pedido, moeda, solicitacao, reembolsoMensagem: req.query.reembolso === 'enviado' });
  } catch (erro) { next(erro); }
});

router.get('/pedidos/:numero/reembolso', exigirLogin, async (req, res, next) => {
  try {
    const pedido = (await pool.query(
      'SELECT * FROM pedidos WHERE numero=$1 AND usuario_id=$2',
      [req.params.numero, req.usuario.id]
    )).rows[0];
    if (!pedido) return res.sendStatus(404);
    const solicitacao = (await pool.query(
      'SELECT * FROM solicitacoes_reembolso WHERE pedido_id=$1 AND usuario_id=$2',
      [pedido.id, req.usuario.id]
    )).rows[0] || null;
    res.render('user/reembolso', { pedido, solicitacao, moeda });
  } catch (erro) { next(erro); }
});

router.post('/pedidos/:numero/reembolso', exigirLogin, csrf, async (req, res, next) => {
  try {
    const motivos = ['Produto com defeito', 'Produto danificado no transporte', 'Produto diferente do solicitado', 'Produto não recebido', 'Arrependimento da compra', 'Outro motivo'];
    const motivo = String(req.body.motivo || '');
    const detalhes = String(req.body.detalhes || '').trim();
    if (!motivos.includes(motivo) || !detalhes || detalhes.length > 50) return res.sendStatus(400);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await client.query(`
        INSERT INTO solicitacoes_reembolso (pedido_id, usuario_id, motivo, detalhes)
        SELECT id, usuario_id, $3, $4 FROM pedidos
        WHERE numero=$1 AND usuario_id=$2 AND pagamento_status IN ('pago','aprovado')
          AND producao_status <> 'cancelado'
        ON CONFLICT (pedido_id) DO NOTHING
        RETURNING id, pedido_id
      `, [req.params.numero, req.usuario.id, motivo, detalhes]);
      if (!resultado.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).send('Pedido não elegível ou solicitação já registrada.');
      }
      const solicitacao = resultado.rows[0];
      const chat = await client.query(`
        INSERT INTO atendimentos (usuario_id, assunto, pedido_id, tipo, reembolso_id)
        VALUES ($1, $2, $3, 'reembolso', $4)
        RETURNING id
      `, [req.usuario.id, 'Reembolso · Pedido #' + req.params.numero, solicitacao.pedido_id, solicitacao.id]);
      await client.query('COMMIT');
      res.redirect('/pedidos/' + encodeURIComponent(req.params.numero) +
        '?abrir_atendimento=1&atendimento_id=' + chat.rows[0].id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (erro) { next(erro); }
});

router.post('/pedidos/:numero/entregue', exigirLogin, csrf, async (req, res, next) => {
  try {
    const resultado = await pool.query(`UPDATE pedidos
      SET producao_status = 'entregue', entregue_em = NOW(), entrega_confirmada_por = 'cliente'
      WHERE numero = $1 AND usuario_id = $2 AND producao_status = 'enviado'
      RETURNING numero`, [req.params.numero, req.usuario.id]);
    if (!resultado.rowCount) return res.status(409).send('Pedido não encontrado ou ainda não enviado.');
    res.redirect('/pedidos/' + encodeURIComponent(resultado.rows[0].numero));
  } catch (erro) { next(erro); }
});

export default router;
