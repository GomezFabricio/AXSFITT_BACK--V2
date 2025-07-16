import { Router } from 'express';
import VentaController from '../controllers/ventas.controller.refactorizado.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

/**
 * Rutas refactorizadas para el módulo de ventas
 * Mantiene exactamente las mismas funcionalidades que las rutas originales
 */

// Obtener todas las ventas
router.get(
  '/', 
  authenticate, 
  validarPermisos('Listado de Ventas'), 
  VentaController.obtenerVentas
);

// Obtener una venta específica por ID
router.get(
  '/:id', 
  authenticate, 
  validarPermisos('Listado de Ventas'), 
  VentaController.obtenerVentaPorId
);

// Crear una nueva venta
router.post(
  '/', 
  authenticate, 
  validarPermisos('Agregar Venta'), 
  VentaController.crearVenta
);

// Actualizar estado de pago
router.put(
  '/:id/estado-pago', 
  authenticate, 
  validarPermisos('Modificar Venta'), 
  VentaController.actualizarEstadoPago
);

// Actualizar estado de envío
router.put(
  '/:id/estado-envio', 
  authenticate, 
  validarPermisos('Modificar Venta'), 
  VentaController.actualizarEstadoEnvio
);

// Buscar productos para venta
router.get(
  '/productos/buscar', 
  authenticate, 
  validarPermisos('Agregar Venta'), 
  VentaController.buscarProductosParaVenta
);

// Obtener variantes de un producto
router.get(
  '/productos/:producto_id/variantes', 
  authenticate, 
  validarPermisos('Agregar Venta'), 
  VentaController.obtenerVariantesProducto
);

// Verificar disponibilidad de stock
router.post(
  '/verificar-stock', 
  authenticate, 
  validarPermisos('Agregar Venta'), 
  VentaController.verificarStock
);

// Actualizar datos de venta
router.put(
  '/:id/datos', 
  authenticate, 
  validarPermisos('Modificar Venta'), 
  VentaController.actualizarDatosVenta
);

// Obtener métricas de ventas
router.get(
  '/metricas/dashboard', 
  authenticate, 
  validarPermisos('Listado de Ventas'), 
  VentaController.obtenerMetricasVentas
);

export default router;
