import VentaService from '../services/venta.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { Validador } from '../utils/validador.js';

/**
 * Controlador refactorizado para ventas
 * Mantiene exactamente las mismas funcionalidades que el controlador original
 * Delega la lógica de negocio al servicio
 */
class VentaController {
  /**
   * Obtiene lista de todas las ventas con información básica
   */
  static async obtenerVentas(req, res) {
    try {
      const ventas = await VentaService.obtenerTodasLasVentas();
      
      // Devolver directamente como el controlador original
      res.status(200).json(ventas);
    } catch (error) {
      console.error('Error al obtener ventas:', error);
      res.status(500).json({ message: 'Error interno al obtener ventas.' });
    }
  }

  /**
   * Obtiene detalles completos de una venta por su ID
   */
  static async obtenerVentaPorId(req, res) {
    try {
      const { id } = req.params;
      
      if (!Validador.esNumeroValido(id)) {
        return res.status(400).json({ message: 'ID de venta inválido.' });
      }

      const venta = await VentaService.obtenerVentaPorId(id);
      
      if (!venta) {
        return res.status(404).json({ message: 'Venta no encontrada.' });
      }

      // Devolver directamente como el controlador original
      res.status(200).json(venta);
    } catch (error) {
      console.error('Error al obtener venta por ID:', error);
      res.status(500).json({ message: 'Error interno al obtener la venta.' });
    }
  }

  /**
   * Crea una nueva venta
   */
  static async crearVenta(req, res) {
    try {
      const { venta, productos, cliente_invitado, envio } = req.body;
      
      // Validaciones básicas siguiendo la estructura del controlador original
      if (!productos || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ message: 'Debe incluir al menos un producto en la venta.' });
      }

      // Si no hay cliente_id pero tampoco hay datos del cliente invitado, es un error
      if (!venta.cliente_id && (!cliente_invitado || !cliente_invitado.nombre || !cliente_invitado.apellido)) {
        return res.status(400).json({ message: 'Debe proporcionar un cliente registrado o datos de cliente invitado.' });
      }

      // Estructurar los datos como espera el servicio
      const datosVenta = {
        venta,
        productos,
        cliente_invitado,
        envio
      };

      const resultado = await VentaService.crearVenta(datosVenta);
      
      // Devolver como el controlador original
      res.status(201).json(resultado);
    } catch (error) {
      console.error('Error al crear venta:', error);
      res.status(500).json({ message: 'Error interno al crear la venta.' });
    }
  }

  /**
   * Actualiza el estado de pago de una venta
   */
  static async actualizarEstadoPago(req, res) {
    try {
      const { id } = req.params;
      const { estado_pago } = req.body;
      
      if (!Validador.esNumeroValido(id)) {
        return res.status(400).json({ message: 'ID de venta inválido.' });
      }

      if (!estado_pago || !['pendiente', 'abonado', 'pagado', 'cancelado'].includes(estado_pago)) {
        return res.status(400).json({ message: 'Estado de pago inválido.' });
      }

      const actualizado = await VentaService.actualizarEstadoPago(id, estado_pago);
      
      if (!actualizado) {
        return res.status(404).json({ message: 'Venta no encontrada.' });
      }

      // Devolver como el controlador original
      res.status(200).json({ message: 'Estado de pago actualizado correctamente.' });
    } catch (error) {
      console.error('Error al actualizar estado de pago:', error);
      
      // Manejar errores específicos del negocio
      if (error.message.includes('No se puede cambiar el estado desde "cancelado"')) {
        return res.status(400).json({ message: 'No se puede cambiar el estado desde "cancelado" a otro estado.' });
      }
      
      if (error.message.includes('No se puede cancelar el estado de pago después de 24 horas')) {
        return res.status(400).json({ message: 'No se puede cancelar el estado de pago después de 24 horas desde la venta.' });
      }
      
      if (error.message.includes('Venta no encontrada')) {
        return res.status(404).json({ message: 'Venta no encontrada.' });
      }
      
      res.status(500).json({ message: 'Error interno al actualizar el estado de pago.' });
    }
  }

  /**
   * Actualiza el estado de envío de una venta
   */
  static async actualizarEstadoEnvio(req, res) {
    try {
      const { id } = req.params;
      const { estado_envio, numero_seguimiento } = req.body;
      
      if (!Validador.esNumeroValido(id)) {
        return res.status(400).json({ message: 'ID de venta inválido.' });
      }

      if (!estado_envio || !['pendiente', 'preparando', 'enviado', 'entregado', 'cancelado'].includes(estado_envio)) {
        return res.status(400).json({ message: 'Estado de envío inválido.' });
      }

      const actualizado = await VentaService.actualizarEstadoEnvio(id, estado_envio, numero_seguimiento);
      
      if (!actualizado) {
        return res.status(404).json({ message: 'Venta no encontrada.' });
      }

      // Devolver como el controlador original
      res.status(200).json({ message: 'Estado de envío actualizado correctamente.' });
    } catch (error) {
      console.error('Error al actualizar estado de envío:', error);
      
      // Manejar errores específicos del negocio
      if (error.message.includes('No se puede cambiar el estado desde "cancelado"')) {
        return res.status(400).json({ message: 'No se puede cambiar el estado desde "cancelado" a otro estado.' });
      }
      
      if (error.message.includes('Venta no encontrada')) {
        return res.status(404).json({ message: 'Venta no encontrada.' });
      }
      
      res.status(500).json({ message: 'Error interno al actualizar el estado de envío.' });
    }
  }

  /**
   * Busca productos para venta
   */
  static async buscarProductosParaVenta(req, res) {
    try {
      const { termino, categoria_id } = req.query;
      
      // Permitir términos vacíos o undefined para mostrar productos destacados
      // Solo validar longitud si hay término
      if (termino && termino.trim().length < 2) {
        return res.status(400).json({ message: 'El término de búsqueda debe tener al menos 2 caracteres.' });
      }

      const productos = await VentaService.buscarProductosParaVenta(termino ? termino.trim() : '', categoria_id);
      
      // Devolver directamente como el controlador original
      res.status(200).json(productos);
    } catch (error) {
      console.error('Error al buscar productos para venta:', error);
      res.status(500).json({ message: 'Error interno al buscar productos.' });
    }
  }

  /**
   * Obtiene variantes de un producto
   */
  static async obtenerVariantesProducto(req, res) {
    try {
      const { producto_id } = req.params;
      
      if (!Validador.esNumeroValido(producto_id)) {
        return res.status(400).json({ message: 'ID de producto inválido.' });
      }

      const variantes = await VentaService.obtenerVariantesProducto(producto_id);
      
      // Devolver directamente como el controlador original
      res.status(200).json(variantes);
    } catch (error) {
      console.error('Error al obtener variantes:', error);
      res.status(500).json({ message: 'Error interno al obtener las variantes.' });
    }
  }

  /**
   * Verifica disponibilidad de stock
   */
  static async verificarStock(req, res) {
    try {
      const { productos } = req.body;
      
      if (!productos || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ message: 'Debe proporcionar una lista de productos.' });
      }

      const resultado = await VentaService.verificarStock(productos);
      
      // Devolver directamente como el controlador original
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al verificar stock:', error);
      res.status(500).json({ message: 'Error interno al verificar stock.' });
    }
  }

  /**
   * Actualiza datos de una venta
   */
  static async actualizarDatosVenta(req, res) {
    try {
      const { id } = req.params;
      const datosVenta = req.body;
      
      if (!Validador.esNumeroValido(id)) {
        return res.status(400).json({ message: 'ID de venta inválido.' });
      }

      const actualizado = await VentaService.actualizarDatosVenta(id, datosVenta);
      
      if (!actualizado) {
        return res.status(404).json({ message: 'Venta no encontrada.' });
      }

      // Devolver como el controlador original
      res.status(200).json({ message: 'Datos de venta actualizados correctamente.' });
    } catch (error) {
      console.error('Error al actualizar datos de venta:', error);
      res.status(500).json({ message: 'Error interno al actualizar los datos de venta.' });
    }
  }

  /**
   * Obtiene métricas de ventas para dashboard
   */
  static async obtenerMetricasVentas(req, res) {
    try {
      const metricas = await VentaService.obtenerMetricasVentas();
      
      // Devolver directamente como el controlador original
      res.status(200).json(metricas);
    } catch (error) {
      console.error('Error al obtener métricas:', error);
      res.status(500).json({ message: 'Error interno al obtener métricas.' });
    }
  }
}

export default VentaController;
