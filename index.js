import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import armarioRoutes from './routes/armarioRoutes.js';
import atendimentoRoutes from './routes/atendimentoRoutes.js';
import lojaRoutes from './routes/lojaRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import Loja from './models/lojaModel.js';
import authRoutes from './routes/authRoutes.js';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import crypto from 'node:crypto';
import pool from './config/database.js';
import { Usuario } from './models/usuarioModel.js';
import { csrf } from './middlewares/acesso.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Caminhos para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Defina SESSION_SECRET com pelo menos 32 caracteres no .env');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const PgStore = connectPgSimple(session);
app.use(session({ store: new PgStore({ pool, createTableIfMissing: false }), secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 } }));
app.use(async (req, res, next) => { try { if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex'); req.usuario = req.session.usuarioId ? await Usuario.id(req.session.usuarioId) : null; if (req.session.usuarioId && req.usuario?.bloqueado_em) { req.session.contaBloqueadaId = req.usuario.id; delete req.session.usuarioId; return res.redirect('/conta-bloqueada'); } if (req.session.usuarioId && !req.usuario) { delete req.session.usuarioId; } if (req.session.contaBloqueadaId && req.path !== '/conta-bloqueada' && req.path !== '/login' && req.path !== '/logout') { return res.redirect('/conta-bloqueada'); } res.locals.usuario = req.usuario; res.locals.pedidosPerfil = req.usuario ? (await pool.query('SELECT numero, criado_em AS data, total, producao_status AS status, pagamento_status FROM pedidos WHERE usuario_id=$1 ORDER BY criado_em DESC LIMIT 30', [req.usuario.id])).rows : []; res.locals.cartoesPerfil = req.usuario ? (req.session.cartoesTeste || []).filter(c => c.usuarioId === req.usuario.id) : []; res.locals.enderecosPerfil = req.usuario ? await Usuario.enderecos(req.usuario.id) : []; res.locals.queryPerfilMsg = typeof req.query.perfil_msg === 'string' ? req.query.perfil_msg.slice(0, 150) : ''; res.locals.csrfToken = req.session.csrfToken; res.locals.retorno = req.query.retorno || ''; res.locals.token = req.params.token; next() } catch (e) { next(e) } });
app.use(async (req, res, next) => {
    res.locals.contadoresAdmin = {};
    if (req.usuario?.tipo !== 'admin') return next();
    try {
        const resultado = await pool.query(`SELECT
            COUNT(*) FILTER (WHERE producao_status NOT IN ('enviado', 'entregue', 'cancelado'))::int AS pedidos,
            COUNT(*) FILTER (WHERE pagamento_status NOT IN ('pago', 'aprovado', 'cancelado', 'reembolsado'))::int AS pagamentos,
            COUNT(*) FILTER (WHERE producao_status = 'enviado')::int AS entregas
            FROM pedidos`);
        const [denuncias, reembolsos, avaliacoesPendentes, atendimentoPendentes] = await Promise.all([
            pool.query("SELECT COUNT(*)::int AS total FROM denuncias_avaliacoes WHERE status = 'pendente'"),
            pool.query("SELECT COUNT(*)::int AS total FROM solicitacoes_reembolso WHERE status = 'pendente'"),
            pool.query("SELECT COUNT(*)::int AS total FROM avaliacoes_np WHERE resposta_admin IS NULL"),
            pool.query("SELECT COUNT(*)::int AS total FROM atendimentos WHERE status = 'aberto'")
        ]);
        res.locals.contadoresAdmin = {
            ...resultado.rows[0],
            clientes: denuncias.rows[0].total,
            avaliacoes: avaliacoesPendentes.rows[0].total,
            devolucoes: reembolsos.rows[0].total,
            reembolsos: reembolsos.rows[0].total,
            atendimento: atendimentoPendentes.rows[0].total
        };
        next();
    } catch (erro) { next(erro); }
});
app.use(csrf);
app.use(authRoutes);
app.use(atendimentoRoutes);
// Formatação de preços
function moeda(valor) {
    return Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Página inicial
app.get('/', async (req, res) => {
    try {
        const bonecas = await Loja.listar();

        res.render('user/home', {
            bonecas,
            moeda
        });
    } catch (erro) {
        console.error('Erro ao carregar a Home:', erro);

        res.status(500).send(
            'Não foi possível carregar a Home. Verifique a conexão ' +
            'com o PostgreSQL e as tabelas das bonecas NP.'
        );
    }
});

// Página Sobre Nós
app.get('/sobre', (req, res) => {
    res.render('user/sobre');
});

// Rotas da loja e administração
app.use(lojaRoutes);
app.use(checkoutRoutes);

// Rotas do armário e personalização
app.use(armarioRoutes);

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(
        `Servidor rodando em http://localhost:${PORT}`
    );
});
