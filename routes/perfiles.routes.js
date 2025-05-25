import { Router } from 'express';
import { listarPerfiles, crearPerfil, modificarPerfil, eliminarPerfil } from '../controllers/perfiles.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

// Obtener todos los perfiles
router.get('/', authenticate, listarPerfiles);

// Crear un nuevo perfil
router.post('/', authenticate, crearPerfil);

// Modificar un perfil existente
router.put('/:perfil_id', authenticate, modificarPerfil);

// Eliminar un perfil existente
router.delete('/:perfil_id', authenticate, eliminarPerfil);

export default router;