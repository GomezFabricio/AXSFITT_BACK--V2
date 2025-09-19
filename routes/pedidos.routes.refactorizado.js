import { Router } from 'express';
import {
  obtenerPedidos,
  obtenerPedidoPorId,
  crearPedido,
  precargarProductoSinRegistrar,
  recepcionarPedido,
  cancelarPedido,
  modificarPedido,
  modificarPedidoCompleto,
  obtenerHistorialModificaciones
} from '../controllers/pedidos.controller.refactorizado.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

// Obtener todos los pedidos
router.get(
  '/',
  authenticate,
  validarPermisos('Gestionar Pedidos'),
  obtenerPedidos
);

// Obtener pedido por ID
router.get(
  '/:id',
  authenticate,
  validarPermisos('Gestionar Pedidos'),
  obtenerPedidoPorId
);

// Crear pedido
router.post(
  '/',
  authenticate,
  validarPermisos('Crear Pedido'),
  crearPedido
);

// Endpoint de debug para ver qué datos llegan
router.post(
  '/debug',
  authenticate,
  validarPermisos('Crear Pedido'),
  (req, res) => {
    console.log('=== DEBUG DATOS RECIBIDOS ===');
    console.log('Body completo:', JSON.stringify(req.body, null, 2));
    console.log('variantesBorrador:', req.body.variantesBorrador);
    console.log('productosBorrador:', req.body.productosBorrador);
    console.log('==============================');
    res.json({ success: true, message: 'Datos recibidos y logueados', data: req.body });
  }
);

// Precargar producto sin registrar
router.post(
  '/precargar-producto',
  authenticate,
  validarPermisos('Crear Pedido'),
  precargarProductoSinRegistrar
);

// Recepcionar pedido
router.post(
  '/recepcionar',
  authenticate,
  validarPermisos('Recibir Pedido'),
  recepcionarPedido
);

// Otros endpoints CRUD, edición, cancelación, historial, etc. pueden agregarse aquí siguiendo el patrón
// Cancelar pedido (baja)
router.post(
  '/cancelar',
  authenticate,
  validarPermisos('Cancelar Pedido'), // Debe coincidir con carga inicial
  cancelarPedido
);

// Modificar pedido (actualización y registro en historial)
router.post(
  '/modificar',
  authenticate,
  validarPermisos('Modificar Pedido'), // Debe coincidir con carga inicial
  modificarPedido
);

// Modificar pedido completo con productos, variantes y productos borrador
router.post(
  '/modificar-completo',
  authenticate,
  validarPermisos('Modificar Pedido'), // Debe coincidir con carga inicial
  modificarPedidoCompleto
);

// Obtener historial de modificaciones
router.get(
  '/:pedido_id/historial',
  authenticate,
  validarPermisos('Ver Histórico Modificaciones'),
  obtenerHistorialModificaciones
);

export default router;
