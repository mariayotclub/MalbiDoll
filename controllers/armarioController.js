
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
            const isAdmin = req.path === "/armario";
            const pagina = isAdmin
                ? "admin/armarioAdmin"
                : "user/armarioUser";

            res.render(pagina, { categorias, itens, isAdmin, corpoPadrao });
        } catch (erro) {
            console.error("Erro ao carregar armário:", erro);
            res.status(500).send("Erro ao carregar o armário.");
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

    async adicionarItem(req, res) {
        try {
            const {
                nome,
                descricao,
                preco,
                z_index,
                subcategoria_id,
                imagemProcessada
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
                subcategoria_id: Number.parseInt(subcategoria_id, 10)
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
                imagemProcessada
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
                subcategoria_id: Number.parseInt(subcategoria_id, 10)
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
