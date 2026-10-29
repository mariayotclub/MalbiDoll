export function exigirLogin(req, res, next) {
    if (!req.session.usuarioId) {
        return res.redirect('/login?retorno=' + encodeURIComponent(req.originalUrl));
    }

    next();
}

export function exigirAdmin(req, res, next) {
    if (!req.usuario || req.usuario.tipo !== 'admin') {
        return res.sendStatus(403);
    }

    next();
}

export function csrf(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // O upload de foto é processado pelo Multer na rota /perfil/foto.
    // Após o Multer preencher req.body, a mesma função csrf é executada novamente.
    if (req.is('multipart/form-data') && !req.body?._csrf) {
        if (req.path === '/perfil/foto' || /^\/bonecas\/\d+\/avaliacoes$/.test(req.path)) {
            return next();
        }

        return res.status(403).send('Formulário não autorizado.');
    }

    const recebido = req.body?._csrf || req.get('x-csrf-token');
    const esperado = req.session?.csrfToken;

    if (!recebido || !esperado || recebido !== esperado) {
        return res.status(403).send('Formulário expirado. Recarregue a página.');
    }

    next();
}
