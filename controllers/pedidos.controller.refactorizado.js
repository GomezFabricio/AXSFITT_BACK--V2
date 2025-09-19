import PedidoService from '../services/pedido.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { Validador } from '../utils/validador.js';

// Obtener todos los pedidos
export const obtenerPedidos = async (req, res) => {
  try {
    const pedidos = await PedidoService.obtenerPedidosDetallado();
    return ApiResponse.success(res, pedidos, 'Pedidos obtenidos exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'obtener pedidos');
  }
};

// Obtener pedido por ID
export const obtenerPedidoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const pedido = await PedidoService.obtenerPedidoPorId(id);
    if (!pedido) {
      return ApiResponse.error(res, 'Pedido no encontrado.', 404);
    }
    // Unificar productosSinRegistrar, variantesBorrador y productosBorrador en la respuesta si es necesario
    return ApiResponse.success(res, pedido, 'Pedido obtenido exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'obtener pedido');
  }
};

// Crear pedido
export const crearPedido = async (req, res) => {
  console.log('=== INICIO CREAR PEDIDO ===');
  try {
    // Debug: Imprimir datos recibidos
    console.log('🔍 DATOS RECIBIDOS EN CONTROLADOR:');
    console.log('req.body:', JSON.stringify(req.body, null, 2));
    console.log('req.user:', req.user);

    // Validar que el usuario esté autenticado
    if (!req.user || !req.user.usuario_id) {
      return ApiResponse.error(res, 'Usuario no autenticado.', 401);
    }

    // Agregar usuario_id al body del request
    const datosPedido = {
      ...req.body,
      pedido_usuario_id: req.user.usuario_id
    };

    console.log('📦 DATOS DEL PEDIDO PROCESADOS:', JSON.stringify(datosPedido, null, 2));

    // Validar estructura básica antes de crear
    if (!datosPedido.proveedor_id) {
      return ApiResponse.error(res, 'proveedor_id es requerido.', 400);
    }

    if (!datosPedido.productos && !datosPedido.variantesBorrador && !datosPedido.productosBorrador) {
      return ApiResponse.error(res, 'Debe incluir al menos un producto, variante borrador o producto borrador.', 400);
    }

    // Crear pedido con validaciones internas
    console.log('📦 LLAMANDO A PedidoService.crearPedido...');
    const pedido_id = await PedidoService.crearPedido(datosPedido);
    console.log('✅ PEDIDO CREADO CON ID:', pedido_id);
    return ApiResponse.success(res, { pedido_id }, 'Pedido creado exitosamente. Precios comparados y registrados en historial.', 201);
  } catch (error) {
    console.error('❌ ERROR EN CREAR PEDIDO:', error);
    console.error('Stack trace:', error.stack);
    // Si es un error de validación, retornar 400
    if (error.message && error.message.includes('Errores de validación')) {
      return ApiResponse.error(res, error.message, 400);
    }
    return ApiResponse.manejarErrorDB(error, res, 'crear pedido');
  }
};

// Precargar producto sin registrar
export const precargarProductoSinRegistrar = async (req, res) => {
  try {
    // Validar datos
    // TODO: usar Validador.validarProductoSinRegistrar si existe
    const producto_id = await PedidoService.precargarProductoSinRegistrar(req.body);
    return ApiResponse.success(res, { producto_id }, 'Producto sin registrar precargado.', 201);
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'precargar producto sin registrar');
  }
};

// Recepcionar pedido
export const recepcionarPedido = async (req, res) => {
  try {
    const { pedido_id, recepcion, usuario_id } = req.body;
    await PedidoService.recepcionarPedido(pedido_id, recepcion, usuario_id);
    return ApiResponse.success(res, null, 'Pedido recepcionado exitosamente.');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'recepcionar pedido');
  }
};

// Otros métodos CRUD, edición, cancelación, historial, etc. pueden agregarse aquí siguiendo el patrón
// Cancelar pedido (baja)
export const cancelarPedido = async (req, res) => {
  try {
    const { pedido_id, motivo_cancelacion, usuario_id } = req.body;
    // Validar datos
    // TODO: usar Validador.validarCancelacionPedido si existe
    await PedidoService.cancelarPedido(pedido_id, motivo_cancelacion, usuario_id);
    return ApiResponse.success(res, null, 'Pedido cancelado exitosamente.');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'cancelar pedido');
  }
};

// Modificar pedido (actualización y registro en historial)
export const modificarPedido = async (req, res) => {
  try {
    const { pedido_id, modificaciones, motivo, itemsEliminados, variantesBorradorEliminadas, productosBorradorEliminados } = req.body;
    
    // Validar datos requeridos
    if (!pedido_id) {
      return ApiResponse.error(res, 'pedido_id es requerido.', 400);
    }

    // Validar que el usuario esté autenticado
    if (!req.user || !req.user.usuario_id) {
      return ApiResponse.error(res, 'Usuario no autenticado.', 401);
    }

    // Si hay modificaciones complejas (items, eliminaciones), usar el método completo
    if (modificaciones?.items || modificaciones?.variantesBorrador || modificaciones?.productosBorrador || 
        itemsEliminados?.length > 0 || variantesBorradorEliminadas?.length > 0 || productosBorradorEliminados?.length > 0) {
      
      const datosCompletos = {
        modificaciones,
        itemsEliminados: itemsEliminados || [],
        variantesBorradorEliminadas: variantesBorradorEliminadas || [],
        productosBorradorEliminados: productosBorradorEliminados || []
      };
      
      const result = await PedidoService.modificarPedidoCompleto(
        pedido_id, 
        datosCompletos, 
        req.user.usuario_id, 
        motivo || 'Modificación completa de pedido'
      );
      
      return ApiResponse.success(res, result, 'Pedido modificado exitosamente');
    } else {
      // Para modificaciones simples, usar el método original
      if (!modificaciones || Object.keys(modificaciones).length === 0) {
        return ApiResponse.error(res, 'No se especificaron modificaciones.', 400);
      }
      
      await PedidoService.modificarPedido(pedido_id, modificaciones, req.user.usuario_id, motivo?.trim() || 'Modificación de pedido');
      return ApiResponse.success(res, null, 'Pedido modificado y registrado en historial.');
    }
  } catch (error) {
    console.error('Error al modificar pedido:', error);
    if (error.message.includes('no encontrado') || error.message.includes('estado pendiente')) {
      return ApiResponse.error(res, error.message, 400);
    }
    return ApiResponse.manejarErrorDB(error, res, 'modificar pedido');
  }
};

// Obtener historial de modificaciones
export const obtenerHistorialModificaciones = async (req, res) => {
  try {
    const { pedido_id } = req.params;
    
    if (!pedido_id) {
      return ApiResponse.error(res, 'pedido_id es requerido.', 400);
    }

    const historial = await PedidoService.obtenerHistorialModificaciones(pedido_id);
    return ApiResponse.success(res, historial, 'Historial obtenido exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'obtener historial de modificaciones');
  }
};
