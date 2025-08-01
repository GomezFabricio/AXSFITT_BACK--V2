import { Router } from 'express';
import {
  obtenerPedidos,
  obtenerPedidoPorId,
  crearPedido,
  precargarProductoSinRegistrar,
  recepcionarPedido,
  cancelarPedido,
  modificarPedido
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

export default router;
