import { Router } from 'express';
import { listarPerfiles, crearPerfil, modificarPerfil, eliminarPerfil } from '../controllers/perfiles.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

// Obtener todos los perfiles
router.get('/', authenticate, validarPermisos('Ver Perfiles'), listarPerfiles);

// Crear un nuevo perfil
router.post('/', authenticate, validarPermisos('Agregar Perfil'), crearPerfil);

// Modificar un perfil existente
router.put('/:perfil_id', authenticate, validarPermisos('Modificar Perfil'), modificarPerfil);

// Eliminar un perfil existente
router.delete('/:perfil_id', authenticate, validarPermisos('Eliminar Perfil'), eliminarPerfil);

export default router;