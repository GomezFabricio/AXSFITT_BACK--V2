import { Router } from 'express';
import multer from 'multer';
import { crearProducto, guardarImagenTemporal, obtenerImagenesTemporales, moverImagenTemporal } from '../controllers/productos.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

// Configuración de Multer para guardar imágenes en la carpeta "uploads"
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads'); // Carpeta donde se guardarán las imágenes
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Ruta para crear un producto
router.post('/', authenticate, crearProducto);

// Ruta para guardar imágenes en la tabla temporal
router.post('/imagenes-temporales', authenticate, upload.single('file'), guardarImagenTemporal);

// Ruta para obtener imágenes temporales
router.get('/imagenes-temporales/:usuario_id', authenticate, obtenerImagenesTemporales);

// Ruta para mover una imagen temporal a una nueva posición
router.put('/imagenes-temporales/mover', authenticate, moverImagenTemporal);

export default router;