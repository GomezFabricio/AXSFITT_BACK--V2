import { NotificacionesService } from '../services/notificaciones.service.js';
import NotificacionesStockService from '../services/notificaciones-stock.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

/**
 * Controlador para gestión de notificaciones de stock bajo
 */

/**
 * Obtiene la configuración actual de notificaciones
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerConfiguracionNotificaciones = async (req, res) => {
  try {
    const configuraciones = await NotificacionesService.obtenerConfiguracion();
    res.status(200).json(configuraciones);
  } catch (error) {
    console.error('❌ Error en obtenerConfiguracionNotificaciones:', error);
    return ApiResponse.error(res, 'Error al obtener configuración de notificaciones', 500);
  }
};

/**
 * Actualiza la configuración de notificaciones
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const actualizarConfiguracionNotificaciones = async (req, res) => {
  try {
    const { tipo } = req.params; // 'email' o 'whatsapp'
    const datos = req.body;
    
    await NotificacionesService.actualizarConfiguracion(tipo, datos);
    
    res.status(200).json({ 
      message: 'Configuración de notificaciones actualizada exitosamente' 
    });
  } catch (error) {
    console.error('❌ Error en actualizarConfiguracionNotificaciones:', error);
    return ApiResponse.error(res, 'Error al actualizar configuración de notificaciones', 500);
  }
};

/**
 * Ejecuta el procesamiento manual de notificaciones
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const procesarNotificaciones = async (req, res) => {
  try {
    const resultado = await NotificacionesService.procesarNotificacionesPendientes();
    
    res.status(200).json({
      message: 'Notificaciones procesadas exitosamente',
      resultado
    });
  } catch (error) {
    console.error('❌ Error en procesarNotificaciones:', error);
    return ApiResponse.error(res, 'Error al procesar notificaciones', 500);
  }
};

/**
 * Envía una notificación de prueba
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const enviarNotificacionPrueba = async (req, res) => {
  try {
    const { tipo, destinatario } = req.body;
    
    if (!tipo || !destinatario) {
      return ApiResponse.error(res, 'Tipo y destinatario son requeridos', 400);
    }
    
    await NotificacionesService.enviarPrueba(tipo, destinatario);
    
    res.status(200).json({
      message: `Notificación de prueba ${tipo} enviada exitosamente a ${destinatario}`
    });
  } catch (error) {
    console.error('❌ Error en enviarNotificacionPrueba:', error);
    return ApiResponse.error(res, `Error al enviar notificación de prueba: ${error.message}`, 500);
  }
};

/**
 * Obtiene la lista de destinatarios configurados
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerDestinatarios = async (req, res) => {
  try {
    const { tipo } = req.params;
    const destinatarios = await NotificacionesService.obtenerDestinatarios(tipo);
    
    res.status(200).json({
      success: true,
      data: destinatarios
    });
  } catch (error) {
    console.error('❌ Error en obtenerDestinatarios:', error);
    return ApiResponse.error(res, 'Error al obtener destinatarios', 500);
  }
};

/**
 * Actualiza la lista de destinatarios
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const actualizarDestinatarios = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { destinatarios } = req.body;
    
    if (!destinatarios || !Array.isArray(destinatarios)) {
      return ApiResponse.error(res, 'La lista de destinatarios debe ser un array', 400);
    }
    
    await NotificacionesService.actualizarDestinatarios(tipo, destinatarios);
    
    res.status(200).json({
      success: true,
      message: 'Destinatarios actualizados correctamente'
    });
  } catch (error) {
    console.error('❌ Error en actualizarDestinatarios:', error);
    return ApiResponse.error(res, 'Error al actualizar destinatarios', 500);
  }
};

/**
 * Activa o desactiva las notificaciones de un tipo específico
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const toggleNotificaciones = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { activo } = req.body;
    
    await NotificacionesService.toggleNotificaciones(tipo, activo);
    
    res.status(200).json({
      success: true,
      message: `Notificaciones ${tipo} ${activo ? 'activadas' : 'desactivadas'} correctamente`
    });
  } catch (error) {
    console.error('❌ Error en toggleNotificaciones:', error);
    return ApiResponse.error(res, 'Error al cambiar estado de notificaciones', 500);
  }
};

// Funciones eliminadas para evitar duplicación

/**
 * Obtiene todos los contactos
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerContactos = async (req, res) => {
  try {
    const contactos = await NotificacionesService.obtenerContactos();
    
    res.status(200).json({
      success: true,
      data: contactos
    });
  } catch (error) {
    console.error('❌ Error en obtenerContactos:', error);
    return ApiResponse.error(res, 'Error al obtener contactos', 500);
  }
};

/**
 * Crea un nuevo contacto
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const crearContacto = async (req, res) => {
  try {
    const datos = req.body;
    
    if (!datos.nombre || (!datos.email && !datos.telefono)) {
      return ApiResponse.error(res, 'Nombre y al menos un método de contacto son requeridos', 400);
    }
    
    const contacto = await NotificacionesService.crearContacto(datos);
    
    res.status(201).json({
      success: true,
      data: contacto,
      message: 'Contacto creado correctamente'
    });
  } catch (error) {
    console.error('❌ Error en crearContacto:', error);
    return ApiResponse.error(res, 'Error al crear contacto', 500);
  }
};

/**
 * Actualiza un contacto existente
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const actualizarContacto = async (req, res) => {
  try {
    const { id } = req.params;
    const datos = req.body;
    
    await NotificacionesService.actualizarContacto(id, datos);
    
    res.status(200).json({
      success: true,
      message: 'Contacto actualizado correctamente'
    });
  } catch (error) {
    console.error('❌ Error en actualizarContacto:', error);
    return ApiResponse.error(res, 'Error al actualizar contacto', 500);
  }
};

/**
 * Elimina un contacto
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const eliminarContacto = async (req, res) => {
  try {
    const { id } = req.params;
    
    await NotificacionesService.eliminarContacto(id);
    
    res.status(200).json({
      success: true,
      message: 'Contacto eliminado correctamente'
    });
  } catch (error) {
    console.error('❌ Error en eliminarContacto:', error);
    return ApiResponse.error(res, 'Error al eliminar contacto', 500);
  }
};

/**
 * Obtiene la configuración de frecuencia
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerConfiguracionFrecuencia = async (req, res) => {
  try {
    const configuracion = await NotificacionesService.obtenerConfiguracionFrecuencia();
    
    res.status(200).json({
      success: true,
      data: configuracion
    });
  } catch (error) {
    console.error('❌ Error en obtenerConfiguracionFrecuencia:', error);
    return ApiResponse.error(res, 'Error al obtener configuración de frecuencia', 500);
  }
};

/**
 * Actualiza la configuración de frecuencia
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const actualizarConfiguracionFrecuencia = async (req, res) => {
  try {
    const { tipo } = req.params;
    const datos = req.body;
    
    await NotificacionesService.actualizarConfiguracionFrecuencia(tipo, datos);
    
    res.status(200).json({
      success: true,
      message: 'Configuración de frecuencia actualizada correctamente'
    });
  } catch (error) {
    console.error('❌ Error en actualizarConfiguracionFrecuencia:', error);
    return ApiResponse.error(res, 'Error al actualizar configuración de frecuencia', 500);
  }
};

/**
 * Obtiene la lista de productos/variantes con faltantes detectados
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerFaltantes = async (req, res) => {
  try {
    const faltantes = await NotificacionesService.obtenerFaltantesDetectados();
    res.status(200).json(faltantes);
  } catch (error) {
    console.error('❌ Error en obtenerFaltantes:', error);
    return ApiResponse.error(res, 'Error al obtener faltantes', 500);
  }
};

/**
 * Ejecuta el procesamiento completo de notificaciones con agrupación
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const procesarNotificacionesCompletas = async (req, res) => {
  try {
    console.log('🚀 Procesamiento completo solicitado por usuario:', req.user?.email || 'Desconocido');
    
    const resultado = await NotificacionesStockService.procesarNotificaciones();
    
    res.status(200).json({
      success: true,
      message: 'Procesamiento de notificaciones completado',
      data: resultado,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en procesarNotificacionesCompletas:', error);
    return ApiResponse.error(res, 'Error al procesar notificaciones', 500);
  }
};

/**
 * Ejecuta manualmente el proceso de agrupación
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const agruparNotificaciones = async (req, res) => {
  try {
    console.log('🔗 Agrupación manual solicitada por usuario:', req.user?.email || 'Desconocido');
    
    const resultado = await NotificacionesStockService.ejecutarAgrupacionAutomatica();
    
    res.status(200).json({
      success: true,
      message: 'Agrupación de notificaciones completada',
      data: resultado,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en agruparNotificaciones:', error);
    return ApiResponse.error(res, 'Error al agrupar notificaciones', 500);
  }
};

/**
 * Obtiene estadísticas de las notificaciones
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerEstadisticasNotificaciones = async (req, res) => {
  try {
    const estadisticas = await NotificacionesStockService.obtenerEstadisticas();
    
    res.status(200).json({
      success: true,
      data: estadisticas,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasNotificaciones:', error);
    return ApiResponse.error(res, 'Error al obtener estadísticas de notificaciones', 500);
  }
};

/**
 * Crea un faltante de prueba para verificar el sistema
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const crearFaltantePrueba = async (req, res) => {
  try {
    const { producto_id, cantidad_faltante = 5, cantidad_original = 20 } = req.body;
    
    if (!producto_id) {
      return res.status(400).json({
        success: false,
        message: 'producto_id es requerido'
      });
    }
    
    console.log(`🧪 Creando faltante de prueba para producto ${producto_id} por usuario:`, req.user?.email || 'Desconocido');
    
    // Crear faltante de prueba
    const { pool } = await import('../db.js');
    const [result] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado,
        faltante_fecha_deteccion
      ) VALUES (?, ?, ?, 'detectado', NOW())
    `, [producto_id, cantidad_original, cantidad_faltante]);
    
    const faltanteId = result.insertId;
    
    // Verificar notificación creada
    const [notificacion] = await pool.query(`
      SELECT id, asunto, tipo_frecuencia, estado, 
             DATE_FORMAT(fecha_envio_programada, '%d/%m/%Y') as fecha_programada
      FROM notificaciones_pendientes 
      WHERE faltante_id = ?
      ORDER BY fecha_creacion DESC 
      LIMIT 1
    `, [faltanteId]);
    
    res.status(200).json({
      success: true,
      message: 'Faltante de prueba creado exitosamente',
      data: {
        faltante_id: faltanteId,
        producto_id,
        cantidad_faltante,
        notificacion_creada: notificacion[0] || null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en crearFaltantePrueba:', error);
    return ApiResponse.error(res, 'Error al crear faltante de prueba', 500);
  }
};