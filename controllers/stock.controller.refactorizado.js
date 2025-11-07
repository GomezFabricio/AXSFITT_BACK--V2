import { StockService } from '../services/stock.service.js';
import NotificacionesStockService from '../services/notificaciones-stock.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

/**
 * Controlador refactorizado para gestión de stock
 * Maneja operaciones de stock, faltantes y control de inventario
 */

/**
 * Obtiene el stock de todos los productos con sus variantes
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerStock = async (req, res) => {
  try {
    const productos = await StockService.obtenerStock();
    res.status(200).json(productos);
  } catch (error) {
    console.error('❌ Error en obtenerStock:', error);
    return ApiResponse.error(res, 'Error interno al obtener productos.', 500);
  }
};

/**
 * Actualiza los valores mínimo y máximo de stock
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_minimo, stock_maximo, tipo } = req.body;

    await StockService.actualizarStock(id, stock_minimo, stock_maximo, tipo);
    
    res.json({ message: "Stock actualizado correctamente" });
  } catch (error) {
    console.error('❌ Error en updateStock:', error);
    
    if (error.message.includes('Tipo inválido')) {
      return ApiResponse.error(res, error.message, 400);
    }
    
    if (error.message.includes('no encontrado')) {
      return ApiResponse.error(res, error.message, 404);
    }
    
    return ApiResponse.error(res, 'Error al actualizar el stock', 500);
  }
};

/**
 * Obtiene todos los faltantes (registrados y por registrar)
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerFaltantes = async (req, res) => {
  try {
    const faltantes = await StockService.obtenerFaltantes();
    res.status(200).json(faltantes);
  } catch (error) {
    console.error('❌ Error en obtenerFaltantes:', error);
    return ApiResponse.error(res, 'Error interno al obtener faltantes.', 500);
  }
};

/**
 * Registra un nuevo faltante o actualiza uno existente
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const registrarFaltante = async (req, res) => {
  try {
    const { producto_id, variante_id, cantidad_faltante } = req.body;
    
    const resultado = await StockService.registrarFaltante(
      producto_id, 
      variante_id, 
      cantidad_faltante
    );
    
    const statusCode = resultado.message.includes('actualizado') ? 200 : 201;
    res.status(statusCode).json(resultado);
  } catch (error) {
    console.error('❌ Error en registrarFaltante:', error);
    
    if (error.message.includes('Debe especificar')) {
      return ApiResponse.error(res, error.message, 400);
    }
    
    return ApiResponse.error(res, 'Error interno al registrar faltante.', 500);
  }
};

/**
 * Marca un faltante como resuelto
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const resolverFaltante = async (req, res) => {
  try {
    const { id_faltante } = req.params;
    
    await StockService.resolverFaltante(id_faltante);
    
    res.status(200).json({ message: 'Faltante marcado como resuelto.' });
  } catch (error) {
    console.error('❌ Error en resolverFaltante:', error);
    
    if (error.message.includes('no encontrado')) {
      return ApiResponse.error(res, error.message, 404);
    }
    
    return ApiResponse.error(res, 'Error interno al resolver faltante.', 500);
  }
};

/**
 * Marca un faltante como pedido
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const pedirFaltante = async (req, res) => {
  try {
    const { id_faltante } = req.params;
    
    await StockService.pedirFaltante(id_faltante);
    
    res.status(200).json({ message: 'Faltante marcado como pedido.' });
  } catch (error) {
    console.error('❌ Error en pedirFaltante:', error);
    
    if (error.message.includes('no encontrado')) {
      return ApiResponse.error(res, error.message, 404);
    }
    
    return ApiResponse.error(res, 'Error interno al marcar faltante como pedido.', 500);
  }
};

/**
 * Envía notificaciones pendientes de stock
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const enviarNotificacionesStock = async (req, res) => {
  try {
    const resultado = await NotificacionesStockService.procesarNotificaciones();
    
    res.status(200).json({
      message: 'Notificaciones procesadas exitosamente',
      data: resultado
    });
  } catch (error) {
    console.error('❌ Error en enviarNotificacionesStock:', error);
    return ApiResponse.error(res, 'Error al enviar notificaciones de stock.', 500);
  }
};

/**
 * Obtiene estadísticas de notificaciones de stock
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const obtenerEstadisticasNotificaciones = async (req, res) => {
  try {
    const stats = await NotificacionesStockService.obtenerEstadisticas();
    
    res.status(200).json({
      message: 'Estadísticas obtenidas exitosamente',
      data: stats
    });
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticasNotificaciones:', error);
    return ApiResponse.error(res, 'Error al obtener estadísticas de notificaciones.', 500);
  }
};
