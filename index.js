import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import armarioRoutes from './routes/armarioRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de caminhos para ES Modules (__dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do Template Engine (EJS) e pasta de Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para ler arquivos estáticos e dados do formulário (req.body)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Registro das Rotas do Armário
app.use(armarioRoutes);

// Rota raiz (redireciona para o armário por padrão)
app.get('/', (req, res) => {
  res.redirect('/armario');
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando com sucesso na porta ${PORT}: http://localhost:${PORT}`);
});