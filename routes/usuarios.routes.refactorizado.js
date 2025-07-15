import { Router } from 'express';
import UsuarioController from '../controllers/usuarios.controller.refactorizado.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

/**
 * Rutas refactorizadas para usuarios
 * Mantiene las mismas rutas del archivo original pero optimizadas
 * Utiliza el controlador refactorizado para mejor rendimiento
 */

// Listar usuarios con perfiles (equivalente a GET /)
router.get('/', authenticate, validarPermisos('Ver Usuarios'), UsuarioController.listarUsuarios);

// Agregar usuario (equivalente a POST /)
router.post('/', authenticate, validarPermisos('Agregar Usuario'), UsuarioController.agregarUsuario);

// Actualizar perfiles de un usuario (equivalente a PUT /:usuario_id/perfiles)
router.put('/:usuario_id/perfiles', authenticate, validarPermisos('Asignar Perfil'), UsuarioController.actualizarPerfilesUsuario);

export default router;
