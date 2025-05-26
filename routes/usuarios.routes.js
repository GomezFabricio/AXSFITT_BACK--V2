import { Router } from 'express';
import { listarUsuarios, agregarUsuario, actualizarPerfilesUsuario } from '../controllers/usuarios.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, listarUsuarios);

// Alta de usuario (sin asignar perfil)
router.post('/', authenticate, agregarUsuario);

router.put('/:usuario_id/perfiles', authenticate, actualizarPerfilesUsuario);

export default router;