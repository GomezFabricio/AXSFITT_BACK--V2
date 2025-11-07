import { Router } from 'express';
import { 
  updateStock, 
  obtenerStock, 
  obtenerFaltantes, 
  registrarFaltante, 
  resolverFaltante,
  pedirFaltante,
  enviarNotificacionesStock,
  obtenerEstadisticasNotificaciones
} from '../controllers/stock.controller.refactorizado.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

// Rutas de stock v2
router.get(
  '/', authenticate, obtenerStock
);

router.put(
  '/:id', authenticate, updateStock
);

// Rutas para faltantes v2
router.get(
  '/faltantes', authenticate, validarPermisos('Ver Lista de Faltantes'), obtenerFaltantes
);

router.post(
  '/faltantes', authenticate, validarPermisos('Gestionar Stock'), registrarFaltante
);

router.put(
  '/faltantes/:id_faltante/resolver', authenticate, validarPermisos('Gestionar Stock'), resolverFaltante
);

router.put(
  '/faltantes/:id_faltante/pedir', authenticate, validarPermisos('Gestionar Stock'), pedirFaltante
);

// Rutas para notificaciones de stock
router.post(
  '/notificaciones/enviar', authenticate, validarPermisos('Gestionar Stock'), enviarNotificacionesStock
);

router.get(
  '/notificaciones/estadisticas', authenticate, validarPermisos('Gestionar Stock'), obtenerEstadisticasNotificaciones
);

export default router;
