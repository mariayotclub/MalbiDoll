
import ItemModel from "../models/itemModel.js";
import { validarSvg } from "../utils/validarSvg.js";
import { marcarLineart } from "../utils/marcarLineart.js";

function validarMiniatura(valor) {
    if (!valor) return null;

    if (!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(valor)) {
        throw new Error("Miniatura PNG inválida.");
    }

    if (valor.length > 2 * 1024 * 1024) {
        throw new Error("Miniatura muito grande.");
    }

    return valor;
}

function validarPontos(valor) {
    let pontos;
    try { pontos = JSON.parse(valor || '{}'); } catch { throw new Error('JSON de pontos inválido.'); }
    if (!pontos || Array.isArray(pontos) || typeof pontos !== 'object' || Object.keys(pontos).length > 80) throw new Error('Conjunto de pontos inválido.');
    for (const [nome, ponto] of Object.entries(pontos)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(nome) || !ponto || !Number.isFinite(ponto.x) || !Number.isFinite(ponto.y) || Math.abs(ponto.x)>100000 || Math.abs(ponto.y)>100000) throw new Error('Coordenadas de pontos inválidas.');
    }
    return pontos;
}

function validarCores(valor) {
    let cores;
    try { cores = JSON.parse(valor || '[]'); } catch { throw new Error('Paleta de cores inválida.'); }
    if (!Array.isArray(cores) || cores.length > 40 ||
        cores.some(c => typeof c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c))) {
        throw new Error('Informe até 40 cores no formato #RRGGBB.');
    }
    return [...new Set(cores.map(c => c.toUpperCase()))];
}

const armarioController = {
    async exibirArmario(req, res) {
        try {
            const linhas = await ItemModel.buscarCategoriasESubcategorias();
            const itens = await ItemModel.buscarTodosItens();
            const mapaCategorias = {};

            linhas.forEach(linha => {
                const {
                    categoria_id,
                    categoria_nome,
                    subcategoria_id,
                    subcategoria_nome
                } = linha;

                if (!mapaCategorias[categoria_id]) {
                    mapaCategorias[categoria_id] = {
                        id: categoria_id,
                        nome: categoria_nome,
                        subcategorias: []
                    };
                }

                if (subcategoria_id) {
                    mapaCategorias[categoria_id].subcategorias.push({
                        id: subcategoria_id,
                        nome: subcategoria_nome
                    });
                }
            });

            const categorias = Object.values(mapaCategorias);
            const corpoPadrao = await ItemModel.buscarCorpoPadrao();
            const tamanhosCorpo = await ItemModel.buscarTamanhosCorpo();
            const isAdmin = req.path === "/armario";
            const pagina = isAdmin
                ? "admin/armarioAdmin"
                : "user/armarioUser";

            res.render(pagina, { categorias, itens, isAdmin, corpoPadrao, tamanhosCorpo });
        } catch (erro) {
            console.error("Erro ao carregar armário:", erro);
            res.status(500).send("Erro ao carregar o armário.");
        }
    },

    async listarAncorasCorpos(req, res) {
        try {
            const corpos = await ItemModel.listarCorposComAncoras();
            return res.json({ corpos: corpos.map(corpo => ({
                id: corpo.id,
                nome: corpo.nome,
                subcategoria: corpo.subcategoria,
                tamanho: corpo.tamanho,
                tamanho_corpo_id: corpo.tamanho_corpo_id,
                pontos_referencia: corpo.pontos_referencia || {}
            })) });
        } catch (erro) {
            console.error('Erro ao listar âncoras dos corpos:', erro);
            return res.status(500).json({ error: 'Não foi possível carregar as âncoras dos corpos.' });
        }
    },

    async obterSvg(req, res) {
    try {
        const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).send("ID inválido.");
            }

        const item = await ItemModel.buscarItemPorId(id);

            if (!item) {
                return res.status(404).send("Item não encontrado.");
            }

        res.set("X-Content-Type-Options", "nosniff");
        res.type("image/svg+xml");
        if (typeof item.imagem !== "string" || !item.imagem.trim().startsWith("<svg")) {
            return res.status(422).send("Este item não possui SVG original válido.");
        }
        res.send(item.imagem);
        } catch (erro) {
            console.error("Erro ao buscar SVG:", erro);
            res.status(500).send("Erro ao carregar SVG.");
        }
    },

    async obterPontos(req, res) {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
        try {
            const item = await ItemModel.buscarItemPorId(id);
            if (!item) return res.status(404).json({ error: 'Item não encontrado' });
            return res.json({ pontos_referencia: item.pontos_referencia || {} });
        } catch { return res.status(500).json({ error: 'Erro ao buscar pontos' }); }
    },

    async adicionarItem(req, res) {
        try {
            const {
                nome,
                descricao,
                preco,
                z_index,
                subcategoria_id,
                imagemProcessada,
                pontos_referencia,
                cores,
                tamanho_corpo_id
            } = req.body;

            if (!nome?.trim() || !req.file || !subcategoria_id) {
                return res.status(400).send(
                    "Nome, SVG e subcategoria são obrigatórios."
                );
            }

            const imagem = marcarLineart(validarSvg(
                req.file.buffer.toString("utf-8")
            ));

            const miniatura = validarMiniatura(imagemProcessada);

            if (!miniatura) {
                return res.status(400).send(
                    "É necessário gerar a miniatura no Cropper."
                );
            }

            await ItemModel.criarItem({
                nome: nome.trim(),
                descricao: descricao?.trim() || null,
                preco: Number(preco) || 0,
                imagem,
                miniatura,
                z_index: Number.parseInt(z_index, 10) || 1,
                subcategoria_id: Number.parseInt(subcategoria_id, 10),
                pontos_referencia: validarPontos(pontos_referencia),
                cores: validarCores(cores),
                tamanho_corpo_id: await ItemModel.validarTamanhoCorpo(
                    Number(subcategoria_id), tamanho_corpo_id ? Number(tamanho_corpo_id) : null
                )
            });

            res.redirect("/armario");
        } catch (erro) {
            console.error("Erro ao adicionar item:", erro);
            res.status(400).send(erro.message);
        }
    },

    async editarItem(req, res) {
        try {
            const { id } = req.params;
            const {
                nome,
                descricao,
                preco,
                z_index,
                subcategoria_id,
                imagemProcessada,
                pontos_referencia,
                cores,
                tamanho_corpo_id
            } = req.body;

            const imagem = req.file
                ? marcarLineart(validarSvg(req.file.buffer.toString("utf-8")))
                : null;

            const miniatura = imagemProcessada
                ? validarMiniatura(imagemProcessada)
                : null;

            await ItemModel.atualizarItem(Number(id), {
                nome: nome.trim(),
                descricao: descricao?.trim() || null,
                preco: Number(preco) || 0,
                imagem,
                miniatura,
                z_index: Number.parseInt(z_index, 10) || 1,
                subcategoria_id: Number.parseInt(subcategoria_id, 10),
                pontos_referencia: validarPontos(pontos_referencia),
                cores: validarCores(cores),
                tamanho_corpo_id: await ItemModel.validarTamanhoCorpo(
                    Number(subcategoria_id), tamanho_corpo_id ? Number(tamanho_corpo_id) : null
                )
            });
            res.redirect("/armario");
        } catch (erro) {
            console.error("Erro ao editar item:", erro);
            res.status(400).send(erro.message);
        }
    },

    async deletarItem(req, res) {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    error: "ID inválido."
                });
            }
            await ItemModel.deletarItem(id);
            res.status(200).json({
                message: "Item excluído com sucesso!"
            });
        } catch (erro) {
            console.error("Erro ao excluir item:", erro);
            res.status(500).json({
                error: "Erro ao excluir item."
            });
        }
    }
};


export default armarioController;
