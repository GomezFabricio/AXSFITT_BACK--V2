import { Router } from 'express';
import { 
  obtenerVentas, 
  obtenerVentaPorId, 
  crearVenta, 
  actualizarEstadoPago, 
  actualizarEstadoEnvio,
  buscarProductosParaVenta,
  obtenerVariantesProducto,
  verificarStock,
  actualizarDatosVenta,
  obtenerMetricasVentas
} from '../controllers/ventas.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

// Obtener todas las ventas
router.get(
  '/', 
  authenticate, 
  validarPermisos('Listado de Ventas'), 
  obtenerVentas
);

// Obtener una venta específica por ID
router.get(
  '/:id', 
  authenticate, 
  validarPermisos('Listado de Ventas'), 
  obtenerVentaPorId
);

// Crear una nueva venta
router.post(
  '/', 
  authenticate, 
  validarPermisos('Agregar Venta'), 
  crearVenta
);

// Actualizar estado de pago de una venta
router.patch(
  '/:id/estado-pago', 
  authenticate, 
  validarPermisos('Modificar Venta'), 
  actualizarEstadoPago
);

// Actualizar estado de envío de una venta
router.patch(
  '/:id/estado-envio', 
  authenticate, 
  validarPermisos('Modificar Venta'), 
  actualizarEstadoEnvio
);

// Buscar productos para agregar a una venta
router.get(
  '/productos/buscar', 
  authenticate, 
  validarPermisos('Agregar Venta'), 
  buscarProductosParaVenta
);

// Obtener variantes de un producto para una venta
router.get(
  '/productos/:producto_id/variantes', 
  authenticate, 
  validarPermisos('Agregar Venta'), 
  obtenerVariantesProducto
);

// Verificar disponibilidad de stock
router.post(
  '/verificar-stock', 
  authenticate, 
  validarPermisos('Agregar Venta'), 
  verificarStock
);

router.put(
  '/:id/datos', 
  authenticate, 
  validarPermisos('Modificar Venta'), 
  actualizarDatosVenta
);

// Obtener métricas de ventas
router.get(
  '/metricas/dashboard', 
  authenticate, 
  validarPermisos('Listado de Ventas'), 
  obtenerMetricasVentas
);

export default router;