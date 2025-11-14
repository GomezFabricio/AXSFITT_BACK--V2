import { Router } from 'express';
import { listarNotificaciones } from '../controllers/notificaciones-lista.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

// Ruta para listar notificaciones (pendientes y enviadas)
router.get(
  '/lista', 
  authenticate, 
  validarPermisos('Ver Lista de Faltantes'), 
  listarNotificaciones
);

export default router;