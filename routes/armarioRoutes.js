
import { Router } from 'express';
import armarioController from '../controllers/armarioController.js';
import upload from '../middlewares/upload.js';
import { exigirLogin, exigirAdmin, csrf } from '../middlewares/acesso.js';

const router = Router();

router.get('/api/ancoras/corpos', armarioController.listarAncorasCorpos);
router.get('/api/itens/:id/pontos', armarioController.obterPontos);
router.get('/api/itens/:id/svg', armarioController.obterSvg);
router.get('/armario', exigirLogin, exigirAdmin, armarioController.exibirArmario);
router.get('/personalizar', armarioController.exibirArmario);
router.get('/armarioUser', armarioController.exibirArmario);
router.post('/armario/item', exigirLogin, exigirAdmin, upload.single('imagem'), csrf, armarioController.adicionarItem);
router.delete('/armario/item/:id', exigirLogin, exigirAdmin, armarioController.deletarItem);
router.post('/armario/item/editar/:id', exigirLogin, exigirAdmin, upload.single('imagem'), csrf, armarioController.editarItem);

export default router;
