import { Router } from 'express';
import {
  obtenerProveedores,
  obtenerProveedorPorId,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor
} from '../controllers/proveedores.controller.refactorizado.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';


const router = Router();


// Obtener todos los proveedores
router.get(
  '/',
  authenticate,
  validarPermisos('Gestionar Proveedores'),
  obtenerProveedores
);

// Obtener un proveedor por ID
router.get(
  '/:id',
  authenticate,
  validarPermisos('Gestionar Proveedores'),
  obtenerProveedorPorId
);

// Crear proveedor
router.post(
  '/',
  authenticate,
  validarPermisos('Agregar Proveedor'),
  crearProveedor
);

// Actualizar proveedor
router.put(
  '/:id',
  authenticate,
  validarPermisos('Modificar Proveedor'),
  actualizarProveedor
);

// Eliminar proveedor (borrado lógico)
router.delete(
  '/:id',
  authenticate,
  validarPermisos('Eliminar Proveedor'),
  eliminarProveedor
);

export default router;
