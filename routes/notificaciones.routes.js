import { Router } from 'express';
import { 
  obtenerConfiguracionNotificaciones,
  actualizarConfiguracionNotificaciones,
  procesarNotificaciones,
  enviarNotificacionPrueba,
  obtenerDestinatarios,
  actualizarDestinatarios,
  toggleNotificaciones,
  obtenerContactos,
  crearContacto,
  actualizarContacto,
  eliminarContacto,
  obtenerConfiguracionFrecuencia,
  actualizarConfiguracionFrecuencia,
  obtenerFaltantes
} from '../controllers/notificaciones.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

// Rutas para gestión de notificaciones de stock
router.get(
  '/configuracion', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  obtenerConfiguracionNotificaciones
);

router.put(
  '/configuracion/:id', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  actualizarConfiguracionNotificaciones
);

router.post(
  '/procesar', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  procesarNotificaciones
);

router.post(
  '/prueba', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  enviarNotificacionPrueba
);

// Rutas para gestión de destinatarios
router.get(
  '/destinatarios/:tipo', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  obtenerDestinatarios
);

router.put(
  '/destinatarios/:tipo', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  actualizarDestinatarios
);

// Ruta para activar/desactivar notificaciones
router.put(
  '/toggle/:tipo', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  toggleNotificaciones
);

// Rutas para gestión de contactos
router.get(
  '/contactos', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  obtenerContactos
);

router.post(
  '/contactos', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  crearContacto
);

router.put(
  '/contactos/:id', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  actualizarContacto
);

router.delete(
  '/contactos/:id', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  eliminarContacto
);

// Rutas para configuración de frecuencia
router.get(
  '/frecuencia', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  obtenerConfiguracionFrecuencia
);

router.put(
  '/frecuencia/:tipo', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  actualizarConfiguracionFrecuencia
);

// Ruta para obtener faltantes detectados
router.get(
  '/faltantes', 
  authenticate, 
  validarPermisos('Gestionar Stock'), 
  obtenerFaltantes
);

export default router;