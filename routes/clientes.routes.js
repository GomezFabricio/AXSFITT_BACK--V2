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
} from '../controllers/clientes.controller.js';
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

// Obtener clientes eliminados
router.get(
  '/eliminados', 
  authenticate, 
  validarPermisos('Ver Clientes'), 
  obtenerClientesEliminados
);

// Buscar clientes
router.get(
  '/buscar', 
  authenticate, 
  validarPermisos('Ver Clientes'), 
  buscarClientes
);

// Reactivar un cliente
router.patch(
  '/reactivar/:id', 
  authenticate, 
  validarPermisos('Modificar Cliente'), 
  reactivarCliente
);

// Crear un nuevo cliente
router.post(
  '/', 
  authenticate, 
  validarPermisos('Agregar Cliente'), 
  crearCliente
);

// Obtener un cliente por ID
router.get(
  '/:id', 
  authenticate, 
  validarPermisos('Ver Clientes'), 
  obtenerClientePorId
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

export default router;