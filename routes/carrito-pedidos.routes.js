import express from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';
import {
  obtenerCarrito,
  agregarAlCarrito,
  quitarDelCarrito,
  actualizarCantidadCarrito,
  obtenerProveedores,
  seleccionarProveedor,
  vaciarCarrito,
  confirmarPedido,
  obtenerFaltantesDisponibles,
  probarConexion,
  obtenerInfoCarrito
} from '../controllers/carrito-pedidos.controller.js';

const router = express.Router();

/**
 * Rutas para el Carrito de Pedido Rápido
 * Todas las rutas requieren autenticación y permisos de gestión de stock
 */

// Middleware de autenticación para todas las rutas
router.use(authenticate);

// Middleware de permisos para gestión de stock
router.use(validarPermisos('Gestionar Stock'));

// ==================== GESTIÓN DEL CARRITO ====================

/**
 * GET /api/carrito-pedidos/carrito
 * Obtener carrito actual del usuario
 */
router.get('/carrito', obtenerCarrito);

/**
 * GET /api/carrito-pedidos/carrito/info
 * Obtener información detallada del carrito con diagnósticos
 */
router.get('/carrito/info', obtenerInfoCarrito);

/**
 * POST /api/carrito-pedidos/carrito/agregar
 * Agregar faltante al carrito
 * Body: { faltante_id, variante_id, cantidad? }
 */
router.post('/carrito/agregar', agregarAlCarrito);

/**
 * DELETE /api/carrito-pedidos/carrito/quitar
 * Quitar item del carrito
 * Body: { item_key }
 */
router.delete('/carrito/quitar', quitarDelCarrito);

/**
 * PUT /api/carrito-pedidos/carrito/cantidad
 * Actualizar cantidad de un item en el carrito
 * Body: { item_key, cantidad }
 */
router.put('/carrito/cantidad', actualizarCantidadCarrito);

/**
 * DELETE /api/carrito-pedidos/carrito/vaciar
 * Vaciar completamente el carrito
 */
router.delete('/carrito/vaciar', vaciarCarrito);

// ==================== GESTIÓN DE PROVEEDORES ====================

/**
 * GET /api/carrito-pedidos/proveedores
 * Obtener lista de proveedores activos
 */
router.get('/proveedores', obtenerProveedores);

/**
 * POST /api/carrito-pedidos/carrito/proveedor
 * Seleccionar proveedor para el carrito
 * Body: { proveedor_id }
 */
router.post('/carrito/proveedor', seleccionarProveedor);

// ==================== CONFIRMACIÓN DE PEDIDO ====================

/**
 * POST /api/carrito-pedidos/carrito/confirmar
 * Confirmar pedido: Crear pedido en BD y actualizar faltantes
 */
router.post('/carrito/confirmar', confirmarPedido);

// ==================== UTILIDADES ====================

/**
 * GET /api/carrito-pedidos/faltantes
 * Obtener faltantes disponibles para agregar al carrito
 */
router.get('/faltantes', obtenerFaltantesDisponibles);

/**
 * GET /api/carrito-pedidos/test
 * Endpoint de diagnóstico para probar conectividad
 */
router.get('/test', probarConexion);

export default router;