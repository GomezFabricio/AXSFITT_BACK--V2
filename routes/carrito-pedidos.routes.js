import express from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';
import {
  obtenerCarrito,
  agregarAlCarrito,
  quitarDelCarrito,
  actualizarCantidadCarrito,
  seleccionarProveedor,
  obtenerProveedores,
  vaciarCarrito,
  crearPedidoDesdeCarrito,
  agregarTodosFaltantes
} from '../controllers/carrito-pedidos.controller.js';

const router = express.Router();

/**
 * Rutas para Carrito de Pedido Rápido
 * Todas las rutas requieren autenticación y permisos de gestión de stock
 */

// Middleware de autenticación para todas las rutas
router.use(authenticate);

// Middleware de permisos para gestión de stock
router.use(validarPermisos('Gestionar Stock'));

// ==================== GESTIÓN DEL CARRITO ====================

/**
 * GET /api/carrito-pedidos/carrito
 * Obtener el carrito actual del usuario
 */
router.get('/carrito', obtenerCarrito);

/**
 * POST /api/carrito-pedidos/carrito/agregar
 * Agregar un faltante al carrito
 * Body: { faltante_id?, producto_id?, variante_id?, cantidad_necesaria? }
 */
router.post('/carrito/agregar', agregarAlCarrito);

/**
 * DELETE /api/carrito-pedidos/carrito/quitar
 * Quitar un item del carrito
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
 * POST /api/carrito-pedidos/carrito/agregar-todos
 * Agregar todos los faltantes pendientes al carrito
 */
router.post('/carrito/agregar-todos', agregarTodosFaltantes);

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
 * Crear pedido real desde el carrito y actualizar estados de faltantes
 */
router.post('/carrito/confirmar', crearPedidoDesdeCarrito);

export default router;