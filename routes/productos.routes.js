import { Router } from 'express';
import { crearProducto, guardarImagenTemporal, obtenerImagenesTemporales} from '../controllers/productos.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

// Ruta para crear un producto
router.post('/', authenticate, crearProducto);

// Ruta para guardar imágenes en la tabla temporal
router.post('/imagenes-temporales', authenticate, guardarImagenTemporal);

// Ruta para obtener imágenes temporales 
router.get('/imagenes-temporales/:usuario_id', authenticate, obtenerImagenesTemporales);

export default router;