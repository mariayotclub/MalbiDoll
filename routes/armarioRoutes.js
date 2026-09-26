import { Router } from 'express';
import armarioController from '../controllers/armarioController.js';
import upload from '../middlewares/upload.js';

const router = Router();

router.get('/armario', armarioController.exibirArmario);
router.post('/armario/item', upload.single('imagem'), armarioController.adicionarItem);
router.delete('/armario/item/:id', armarioController.deletarItem);

export default router;