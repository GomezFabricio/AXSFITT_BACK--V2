import { Router } from 'express';
import { 
  obtenerClientes, 
  obtenerClientePorId, 
  crearCliente, 
  actualizarCliente, 
  eliminarCliente,
  buscarClientes,
  obtenerClientesEliminados,
  reactivarCliente
} from '../controllers/clientes.controller.refactorizado.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

// Obtener todos los clientes
router.get(
  '/', 
  authenticate, 
  validarPermisos('Ver Clientes'),
  obtenerClientes
);

// Buscar clientes por término
router.get(
  '/buscar',
  authenticate,
  validarPermisos('Ver Clientes'),
  buscarClientes
);

// Obtener un cliente por ID
router.get(
  '/:id',
  authenticate,
  validarPermisos('Ver Clientes'),
  obtenerClientePorId
);

// Crear un nuevo cliente
router.post(
  '/',
  authenticate,
  validarPermisos('Agregar Cliente'),
  crearCliente
);

// Actualizar un cliente existente
router.put(
  '/:id',
  authenticate,
  validarPermisos('Modificar Cliente'),
  actualizarCliente
);

// Eliminar un cliente (baja lógica)
router.delete(
  '/:id',
  authenticate,
  validarPermisos('Eliminar Cliente'),
  eliminarCliente
);

// Obtener clientes dados de baja
router.get(
  '/eliminados/lista',
  authenticate,
  validarPermisos('Ver Clientes'),
  obtenerClientesEliminados
);

// Reactivar un cliente dado de baja
router.patch(
  '/reactivar/:id',
  authenticate,
  validarPermisos('Modificar Cliente'),
  reactivarCliente
);

export default router;
