import { Router } from 'express';
import { listarModulos, modificarModulo, obtenerPermisosPorModulos } from '../controllers/modulos.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

router.get('/', authenticate, validarPermisos('Ver Modulos'), listarModulos);

// Nueva ruta para modificar el nombre del módulo
router.put('/:modulo_id', authenticate, validarPermisos('Modificar Modulo'), modificarModulo);

// Obtener permisos de módulos
router.post('/permisos', authenticate, validarPermisos('Ver Permisos'), obtenerPermisosPorModulos);

export default router;