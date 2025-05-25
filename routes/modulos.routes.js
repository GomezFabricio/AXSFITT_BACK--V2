import { Router } from 'express';
import { listarModulos, modificarModulo } from '../controllers/modulos.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, listarModulos);

// Nueva ruta para modificar el nombre del módulo
router.put('/:modulo_id', authenticate, modificarModulo);

export default router;