import { Router } from 'express';
import { updateStock } from '../controllers/stock.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

router.put(
  '/:id', authenticate, updateStock
);

export default router;