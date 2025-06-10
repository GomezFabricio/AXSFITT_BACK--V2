import { Router } from 'express';
import { listarUsuarios, agregarUsuario, actualizarPerfilesUsuario } from '../controllers/usuarios.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

router.get('/', authenticate, validarPermisos('Ver Usuarios'), listarUsuarios);

// Alta de usuario (sin asignar perfil)
router.post('/', authenticate, validarPermisos('Agregar Usuario'), agregarUsuario);

// Actualizar perfiles de un usuario
router.put('/:usuario_id/perfiles', authenticate, validarPermisos('Asignar Perfil'), actualizarPerfilesUsuario);

export default router;