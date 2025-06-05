import { Router } from 'express';
import { crearProducto } from '../controllers/productos.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

// Ruta para crear un producto
router.post('/', authenticate, crearProducto);

export default router;