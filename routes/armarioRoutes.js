
import { Router } from 'express';
import armarioController from '../controllers/armarioController.js';
import upload from '../middlewares/upload.js';

const router = Router();

router.get('/api/ancoras/corpos', armarioController.listarAncorasCorpos);
router.get('/api/itens/:id/pontos', armarioController.obterPontos);
router.get('/api/itens/:id/svg', armarioController.obterSvg);
router.get('/armario', armarioController.exibirArmario);
router.get('/personalizar', armarioController.exibirArmario);
router.get('/armarioUser', armarioController.exibirArmario);
router.post('/armario/item', upload.single('imagem'), armarioController.adicionarItem);
router.delete('/armario/item/:id', armarioController.deletarItem);
router.post('/armario/item/editar/:id', upload.single('imagem'), armarioController.editarItem);

export default router;
