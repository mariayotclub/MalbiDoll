import ItemModel from '../models/itemModel.js';

const armarioController = {
  async exibirArmario(req, res) {
    try {
      const categoriasESubcategorias = await ItemModel.buscarCategoriasESubcategorias();
      const itens = await ItemModel.buscarTodosItens();

      const mapaCategorias = {};

      categoriasESubcategorias.forEach(linha => {
        const { categoria_id, categoria_nome, subcategoria_id, subcategoria_nome } = linha;

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

      res.render('armario', {
        categorias,
        itens
      });
    } catch (error) {
      console.error('Erro ao carregar a página do armário:', error);
      res.status(500).send('Erro ao carregar o armário.');
    }
  },

  async adicionarItem(req, res) {
    try {
      const { nome, descricao, preco, z_index, subcategoria_id } = req.body;
      let conteudoSvg = '';

      if (req.file && req.file.buffer) {
        conteudoSvg = req.file.buffer.toString('utf-8').trim();
      } else if (req.body.imagem) {
        conteudoSvg = req.body.imagem.trim();
      }

      if (!nome || !conteudoSvg || !subcategoria_id) {
        return res.status(400).send('Preencha todos os campos obrigatórios (Nome, Arquivo SVG e Subcategoria).');
      }

      await ItemModel.criarItem({
        nome: nome.trim(),
        descricao: descricao ? descricao.trim() : null,
        preco: parseFloat(preco) || 0.00,
        imagem: conteudoSvg,
        z_index: parseInt(z_index, 10) || 1,
        subcategoria_id: parseInt(subcategoria_id, 10)
      });

      res.redirect('/armario');
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      res.status(500).send('Erro ao salvar o item.');
    }
  },

  async deletarItem(req, res) {
    try {
      const { id } = req.params;

      // Validação de segurança para garantir que o ID é um número válido
      if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'ID do item inválido ou ausente.' });
      }

      await ItemModel.deletarItem(parseInt(id, 10));
      return res.status(200).json({ message: 'Item excluído com sucesso!' });
    } catch (error) {
      console.error('Erro detalhado ao deletar item:', error);
      // Retorna o texto exato do erro para podermos debugar no popup
      return res.status(500).json({ error: error.message || 'Erro interno no banco de dados ao tentar excluir.' });
    }
  }
};

export default armarioController;