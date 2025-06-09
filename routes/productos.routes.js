import { Router } from 'express';
import multer from 'multer';
import { crearProducto, guardarImagenTemporal, obtenerImagenesTemporales, moverImagenTemporal, eliminarImagenTemporal, cancelarProcesoAltaProducto, obtenerProductos, eliminarProducto, cambiarVisibilidadProducto, obtenerDetallesStock, obtenerProductoPorId, actualizarProducto } from '../controllers/productos.controller.js';
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

// Ruta para eliminar una imagen temporal
router.delete('/imagenes-temporales', authenticate, eliminarImagenTemporal);

// Ruta para cancelar el proceso de alta del producto
router.post('/cancelar-proceso-alta', authenticate, cancelarProcesoAltaProducto);

// Ruta para obtener todos los productos
router.get('/', authenticate, obtenerProductos);

// Ruta para eliminar un producto (baja lógica)
router.delete('/:producto_id', authenticate, eliminarProducto);

// Ruta para cambiar la visibilidad de un producto
router.put('/cambiar-visibilidad', authenticate, cambiarVisibilidadProducto);

// Ruta para obtener detalles del stock de un producto específico
router.get('/detalles-stock/:producto_id', authenticate, obtenerDetallesStock);

// Ruta para obtener un producto por ID
router.get('/:producto_id', authenticate, obtenerProductoPorId); 

// Ruta para actualizar un producto
router.put('/:producto_id', authenticate, actualizarProducto);


export default router;