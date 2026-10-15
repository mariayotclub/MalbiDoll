import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import Loja from '../models/lojaModel.js';

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
            avaliacoes: await Loja.avaliacoes(id)
        });
    } catch (falha) {
        erro(res, falha);
    }
});

router.post('/bonecas/:id/avaliacoes', upload.single('foto'), async (req, res) => {
    try {
        const id = numero(req.params.id);
        const boneca = id && await Loja.obter(id);
        if (!boneca || !boneca.ativo) return res.sendStatus(404);

        const nome = String(req.body.nome || '').trim();
        const comentario = String(req.body.comentario || '').trim();
        const estrelas = Number(req.body.estrelas);

        if (!nome || nome.length > 80 || !comentario || comentario.length > 2000 ||
            !Number.isInteger(estrelas) || estrelas < 0 || estrelas > 5) {
            return res.status(400).send('Dados da avaliação inválidos.');
        }

        await Loja.avaliar({ id, nome, comentario, estrelas, foto: imagemValida(req.file) });
        res.redirect(`/bonecas/${id}#avaliacoes`);
    } catch (falha) {
        res.status(400).send(falha.message);
    }
});

// Administração: estas rotas são apenas para ambiente local, sem login.
router.get('/admin', (req, res) => render(res, 'admin/painel'));

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

router.post('/admin/bonecas', upload.single('imagem'), async (req, res) => {
    try {
        const boneca = dados(req);
        if (!boneca.imagem) return res.status(400).send('Imagem obrigatória no cadastro.');

        await Loja.criar(boneca);
        res.redirect('/admin/bonecas?msg=criada');
    } catch (falha) {
        res.status(400).send(falha.message);
    }
});

router.post('/admin/bonecas/:id/editar', upload.single('imagem'), async (req, res) => {
    try {
        const id = numero(req.params.id);
        if (!id) return res.sendStatus(404);

        const alteradas = await Loja.editar(id, dados(req));
        if (!alteradas) return res.sendStatus(404);

        res.redirect('/admin/bonecas?msg=editada');
    } catch (falha) {
        res.status(400).send(falha.message);
    }
});

router.post('/admin/bonecas/:id/excluir', async (req, res) => {
    try {
        const id = numero(req.params.id);
        if (!id) return res.sendStatus(404);

        const excluidas = await Loja.excluir(id);
        if (!excluidas) return res.sendStatus(404);

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
    if (falha) return res.status(400).send('Envie apenas PNG, JPG, JPEG, WEBP ou GIF (até 3 MB).');
    next();
});

export default router;
