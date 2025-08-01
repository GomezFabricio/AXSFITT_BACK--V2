/**
 * Servicio para gestión de pedidos
 * - Métodos CRUD
 * - Precarga de productos sin registrar
 * - Recepción de pedidos (actualiza stock, precios, historial)
 * - Usa tablas: pedidos, pedidos_detalle, pedidos_modificaciones, stock, stock_movimientos, precios_historicos
 * - Sigue lineamientos: modularidad, contratos claros, sin lógica en controller
 */
import { pool } from '../db.js';

class PedidoService {
  // ==================== QUERIES ESTÁTICAS ====================
  static QUERIES = {
    OBTENER_PEDIDOS: `SELECT * FROM pedidos ORDER BY pedido_fecha_pedido DESC`,
    OBTENER_PEDIDOS_DETALLADO: `
      SELECT p.pedido_id, p.pedido_fecha_pedido, p.pedido_estado, p.pedido_total, p.pedido_descuento, p.pedido_costo_envio, p.pedido_fecha_esperada_entrega,
             pr.proveedor_id, pr.proveedor_nombre,
             u.usuario_id,
             per.persona_nombre, per.persona_apellido
      FROM pedidos p
      LEFT JOIN proveedores pr ON p.pedido_proveedor_id = pr.proveedor_id
      LEFT JOIN usuarios u ON p.pedido_usuario_id = u.usuario_id
      LEFT JOIN personas per ON u.persona_id = per.persona_id
      ORDER BY p.pedido_fecha_pedido DESC
    `,
    OBTENER_PEDIDO_POR_ID: 'SELECT * FROM pedidos WHERE pedido_id = ?',
    CREAR_PEDIDO: `INSERT INTO pedidos (
      pedido_proveedor_id,
      pedido_usuario_id,
      pedido_estado,
      pedido_fecha_pedido,
      pedido_total,
      pedido_descuento,
      pedido_costo_envio,
      pedido_fecha_esperada_entrega
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    CREAR_DETALLE: `INSERT INTO pedidos_detalle (pd_pedido_id, pd_producto_id, pd_cantidad_pedida, pd_precio_unitario) VALUES (?, ?, ?, ?)`,
    CREAR_DETALLE_SIN_REGISTRAR: `INSERT INTO pedidos_detalle (pd_pedido_id, producto_sin_registrar, pd_cantidad_pedida, pd_precio_unitario) VALUES (?, ?, ?, ?)`,
    ACTUALIZAR_PEDIDO: (campos) => `UPDATE pedidos SET ${campos.join(', ')} WHERE pedido_id = ?`,
    ELIMINAR_PEDIDO: `UPDATE pedidos SET pedido_estado = 'cancelado' WHERE pedido_id = ?`,
    RECEPCIONAR_PEDIDO: `UPDATE pedidos SET pedido_estado = 'recibido', pedido_fecha_recepcion = ? WHERE pedido_id = ?`,
    CREAR_MODIFICACION: `INSERT INTO pedidos_modificaciones (pedido_id, usuario_id, descripcion, fecha) VALUES (?, ?, ?, ?)`
  };

  /**
   * Obtiene todos los pedidos
   */
  async obtenerPedidosDetallado() {
    const [rows] = await pool.query(PedidoService.QUERIES.OBTENER_PEDIDOS_DETALLADO);
    return rows;
  }
  
  // Mantener el método original para compatibilidad
  async obtenerPedidos() {
    const [rows] = await pool.query(PedidoService.QUERIES.OBTENER_PEDIDOS);
    return rows;
  }

  /**
   * Obtiene un pedido por ID
   */
  async obtenerPedidoPorId(id) {
    const [rows] = await pool.query(PedidoService.QUERIES.OBTENER_PEDIDO_POR_ID, [id]);
    return rows[0] || null;
  }

  /**
   * Crea un nuevo pedido y sus detalles
   * @param {Object} data - { proveedor_id, productos: [{producto_id, cantidad, precio_costo}], productosSinRegistrar: [{nombre, cantidad, precio_costo}] }
   */
  async crearPedido(data) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const {
        proveedor_id,
        pedido_usuario_id,
        productos = [],
        productosSinRegistrar = [],
        descuento = 0,
        costo_envio = 0,
        fecha_esperada_entrega = null,
        total = null
      } = data;
      const fechaPedido = new Date();
      // Calcular total si no viene
      let pedido_total = total;
      if (pedido_total === null) {
        pedido_total = productos.reduce((acc, p) => acc + ((Number(p.precio_costo) || 0) * (Number(p.cantidad) || 1)), 0);
        pedido_total = Math.max(0, pedido_total - (Number(descuento) || 0)) + (Number(costo_envio) || 0);
      }
      const [pedidoRes] = await conn.query(
        PedidoService.QUERIES.CREAR_PEDIDO,
        [
          proveedor_id,
          pedido_usuario_id,
          'pendiente',
          fechaPedido,
          pedido_total,
          descuento,
          costo_envio,
          fecha_esperada_entrega || null
        ]
      );
      const pedido_id = pedidoRes.insertId;
      // Detalles productos registrados
      for (const prod of productos) {
        await conn.query(PedidoService.QUERIES.CREAR_DETALLE, [pedido_id, prod.producto_id, prod.cantidad, prod.precio_costo]);
      }
      // Detalles productos sin registrar
      for (const prod of productosSinRegistrar) {
        await conn.query(PedidoService.QUERIES.CREAR_DETALLE_SIN_REGISTRAR, [pedido_id, prod.nombre, prod.cantidad, prod.precio_costo]);
      }
      await conn.commit();
      return pedido_id;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Precarga producto sin registrar
   * @param {Object} data - { nombre, categoria_id, precio_costo, stock_inicial }
   */
  async precargarProductoSinRegistrar(data) {
    // Implementar según estructura de productos_sin_registrar
    // Ejemplo:
    const { nombre, categoria_id, precio_costo, stock_inicial } = data;
    const [res] = await pool.query(
      'INSERT INTO productos_sin_registrar (nombre, categoria_id, precio_costo, stock_inicial, estado) VALUES (?, ?, ?, ?, ?)',
      [nombre, categoria_id, precio_costo, stock_inicial, 'pendiente']
    );
    return res.insertId;
  }

  /**
   * Recepcionar pedido: actualiza cantidades recibidas, precios, stock y movimientos
   * @param {number} pedido_id
   * @param {Array} recepcion - [{detalle_id, cantidad_recibida, precio_costo_nuevo}]
   * @param {number} usuario_id
   */
  async recepcionarPedido(pedido_id, recepcion, usuario_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Actualizar estado pedido
      await conn.query(PedidoService.QUERIES.RECEPCIONAR_PEDIDO, [new Date(), pedido_id]);
      // Actualizar detalles y stock
      for (const item of recepcion) {
        // Actualizar detalle
        await conn.query('UPDATE pedidos_detalle SET cantidad_recibida = ?, precio_costo_recibido = ? WHERE detalle_id = ?', [item.cantidad_recibida, item.precio_costo_nuevo, item.detalle_id]);
        // Actualizar stock y movimientos
        await conn.query('UPDATE stock SET cantidad = cantidad + ? WHERE producto_id = ?', [item.cantidad_recibida, item.producto_id]);
        await conn.query('INSERT INTO stock_movimientos (producto_id, cantidad, tipo, fecha, referencia) VALUES (?, ?, ?, ?, ?)', [item.producto_id, item.cantidad_recibida, 'ingreso', new Date(), `Pedido ${pedido_id}`]);
        // Registrar precio histórico si cambió
        if (item.precio_costo_nuevo) {
          await conn.query('INSERT INTO precios_historicos (producto_id, precio, fecha, referencia) VALUES (?, ?, ?, ?)', [item.producto_id, item.precio_costo_nuevo, new Date(), `Pedido ${pedido_id}`]);
        }
      }
      // Registrar modificación
      await conn.query(PedidoService.QUERIES.CREAR_MODIFICACION, [pedido_id, usuario_id, 'Recepción de pedido', new Date()]);
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // Métodos CRUD, edición, cancelación, historial, etc. pueden agregarse aquí siguiendo el patrón
  /**
   * Cancela un pedido: actualiza estado y registra motivo en pedidos_modificaciones
   * @param {number} pedido_id
   * @param {string} motivo_cancelacion
   * @param {number} usuario_id
   */
  async cancelarPedido(pedido_id, motivo_cancelacion, usuario_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Obtener detalle anterior
      const [pedidoAnt] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      // Actualizar estado
      await conn.query('UPDATE pedidos SET pedido_estado = ? WHERE pedido_id = ?', ['cancelado', pedido_id]);
      // Registrar modificación
      await conn.query(
        `INSERT INTO pedidos_modificaciones (pm_pedido_id, pm_usuario_id, pm_motivo, pm_detalle_anterior, pm_detalle_nuevo) VALUES (?, ?, ?, ?, ?)`,
        [
          pedido_id,
          usuario_id,
          motivo_cancelacion || 'Cancelación de pedido',
          JSON.stringify(pedidoAnt[0] || {}),
          JSON.stringify({ pedido_estado: 'cancelado' })
        ]
      );
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Modifica un pedido: actualiza campos y registra en pedidos_modificaciones
   * @param {number} pedido_id
   * @param {object} modificaciones - campos a modificar (ej: {pedido_estado, pedido_total, ...})
   * @param {number} usuario_id
   */
  async modificarPedido(pedido_id, modificaciones, usuario_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Obtener detalle anterior
      const [pedidoAnt] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      // Actualizar pedido
      const campos = Object.keys(modificaciones).map(c => `${c} = ?`).join(', ');
      const valores = Object.values(modificaciones);
      await conn.query(`UPDATE pedidos SET ${campos} WHERE pedido_id = ?`, [...valores, pedido_id]);
      // Obtener detalle nuevo
      const [pedidoNuevo] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      // Registrar modificación
      await conn.query(
        `INSERT INTO pedidos_modificaciones (pm_pedido_id, pm_usuario_id, pm_motivo, pm_detalle_anterior, pm_detalle_nuevo) VALUES (?, ?, ?, ?, ?)`,
        [
          pedido_id,
          usuario_id,
          'Modificación de pedido',
          JSON.stringify(pedidoAnt[0] || {}),
          JSON.stringify(pedidoNuevo[0] || {})
        ]
      );
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

export default new PedidoService();
