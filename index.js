
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import armarioRoutes from './routes/armarioRoutes.js';
import lojaRoutes from './routes/lojaRoutes.js';
import Loja from './models/lojaModel.js';
import authRoutes from './routes/authRoutes.js';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import crypto from 'node:crypto';
import pool from './config/database.js';
import {Usuario} from './models/usuarioModel.js';
import {csrf} from './middlewares/acesso.js';

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
const PgStore=connectPgSimple(session);
app.use(session({store:new PgStore({pool,createTableIfMissing:false}),secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:7*24*60*60*1000}}));
app.use(async(req,res,next)=>{try{if(!req.session.csrfToken)req.session.csrfToken=crypto.randomBytes(32).toString('hex');req.usuario=req.session.usuarioId?await Usuario.id(req.session.usuarioId):null;if(req.session.usuarioId&&!req.usuario)delete req.session.usuarioId;res.locals.usuario=req.usuario;res.locals.enderecosPerfil=req.usuario?await Usuario.enderecos(req.usuario.id):[];res.locals.queryPerfilMsg=typeof req.query.perfil_msg==='string'?req.query.perfil_msg.slice(0,150):'';res.locals.csrfToken=req.session.csrfToken;res.locals.retorno=req.query.retorno||'/perfil';res.locals.token=req.params.token;next()}catch(e){next(e)}});
app.use(csrf);
app.use(authRoutes);
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

// Rotas do armário e personalização
app.use(armarioRoutes);

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(
        `Servidor rodando em http://localhost:${PORT}`
    );
});
