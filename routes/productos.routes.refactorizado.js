import { Router } from 'express';
import multer from 'multer';
import ProductoController from '../controllers/productos.controller.refactorizado.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

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

// === RUTAS PRINCIPALES DE PRODUCTOS ===

// Crear un nuevo producto
router.post('/', 
  authenticate, 
  validarPermisos('Agregar Producto'), 
  ProductoController.crearProducto
);

// Obtener todos los productos
router.get('/', 
  authenticate, 
  validarPermisos('Ver Productos'), 
  ProductoController.obtenerProductos
);

// Eliminar un producto (baja lógica)
router.delete('/:producto_id', 
  authenticate, 
  validarPermisos('Eliminar Producto'), 
  ProductoController.eliminarProducto
);

// Cambiar visibilidad de un producto
router.put('/cambiar-visibilidad', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  ProductoController.cambiarVisibilidad
);

// Reactivar un producto eliminado
router.put('/:producto_id/reactivar', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  ProductoController.reactivarProducto
);

// Obtener detalles del stock de un producto
router.get('/detalles-stock/:producto_id', 
  authenticate, 
  validarPermisos('Ver Productos'), 
  ProductoController.obtenerDetallesStock
);

// Buscar productos por nombre (autocomplete) - NUEVA FUNCIONALIDAD

// Buscar productos por nombre (autocomplete) - NUEVA FUNCIONALIDAD
router.get('/buscar', 
  authenticate, 
  validarPermisos('Ver Productos'), 
  ProductoController.buscarProductosPorNombre
);

// Buscar productos por nombre sin filtrar por estado
router.get('/buscar-sin-estado', 
  authenticate, 
  validarPermisos('Ver Productos'), 
  ProductoController.buscarProductosPorNombreSinEstado
);

// Verificar nombre duplicado - NUEVA FUNCIONALIDAD
router.get('/verificar-nombre', 
  authenticate, 
  validarPermisos('Ver Productos'), 
  ProductoController.verificarNombreDuplicado
);

// Verificar SKU duplicado - NUEVA FUNCIONALIDAD
router.get('/verificar-sku', 
  authenticate, 
  validarPermisos('Ver Productos'), 
  ProductoController.verificarSkuDuplicado
);

// Obtener un producto por ID
router.get('/:producto_id', 
  authenticate, 
  validarPermisos('Ver Productos'), 
  ProductoController.obtenerProductoPorId
);

// Actualizar un producto existente
router.put('/:producto_id', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  ProductoController.actualizarProducto
);

// === RUTAS DE IMÁGENES TEMPORALES ===

// Guardar imagen temporal
router.post('/imagenes-temporales', 
  authenticate, 
  upload.single('file'), 
  ProductoController.guardarImagenTemporal
);

// Obtener imágenes temporales de un usuario
router.get('/imagenes-temporales/:usuario_id', 
  authenticate, 
  ProductoController.obtenerImagenesTemporales
);

// Mover una imagen temporal a una nueva posición
router.put('/imagenes-temporales/mover', 
  authenticate, 
  ProductoController.moverImagenTemporal
);

// Eliminar imagen temporal
router.delete('/imagenes-temporales', 
  authenticate, 
  ProductoController.eliminarImagenTemporal
);

// Cancelar proceso de alta de producto
router.post('/cancelar-proceso-alta', 
  authenticate, 
  ProductoController.cancelarProceso
);

// === RUTAS DE IMÁGENES DE PRODUCTOS ===

// Subir imagen directamente al producto
router.post('/:producto_id/imagenes', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  upload.single('file'), 
  ProductoController.subirImagenProducto
);

// Mover imagen de producto (cambiar orden)
router.put('/imagenes/mover', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  ProductoController.moverImagenProducto
);

// Eliminar imagen específica de un producto
router.delete('/:producto_id/imagenes/:imagen_id', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  ProductoController.eliminarImagenProducto
);

// Cancelar proceso y eliminar imágenes nuevas
router.post('/:producto_id/cancelar-imagenes', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  ProductoController.eliminarImagenesNuevas
);

// === RUTAS DE VARIANTES ===

// Verificar si una variante tiene ventas
router.get('/variantes/:variante_id/ventas', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  ProductoController.verificarVentasVariante
);

// Cambiar estado de una variante
router.put('/variantes/estado', 
  authenticate, 
  validarPermisos('Modificar Producto'), 
  ProductoController.cambiarEstadoVariante
);

export default router;
