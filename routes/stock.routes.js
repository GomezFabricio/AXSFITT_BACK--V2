import { Router } from 'express';
import { updateStock, obtenerStock } from '../controllers/stock.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

router.get(
  '/', authenticate, obtenerStock
);

router.put(
  '/:id', authenticate, updateStock
);

export default router;